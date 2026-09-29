import "server-only";
/**
 * One pass of the inbox cron (spec 6.1 to 6.6): for every active mailbox,
 * INBOX then "Envoyés", parse, classify (bounce, complaint, automatic, human),
 * attach to a thread or open one, store. Idempotent: message_id is unique, a
 * replay stores nothing twice. Nothing here logs an address or a mail body.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/guard";
import { getProgramConfigs } from "./programs";
import { canTransition, stageByRole, stageBySlug } from "./status";
import { imapConfigFor, safeMessage, withImap, type FolderState, type RawMessage } from "./imap";
import { parseRaw, type ParsedInbound } from "./parse";
import { classifyTransport, type TransportInfo } from "./transport";
import { matchByHeaders, matchThread, type MatchResult } from "./match";
import { extractReply, hasOptOutKeyword } from "./reply-extract";
import { optOutContact } from "./optout";
import type { Mailbox, NeedsLeoReason, ProgramConfig } from "./types";

const BATCH_PER_FOLDER = 40;
const MAX_BODY = 100_000;
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
const STORABLE = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const SOFT_BOUNCE_LIMIT = 3;

export interface MailboxRun {
  mailbox: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  read: number;
  stored: number;
  ignored: number;
  duplicates: number;
  bounces: number;
  errors: number;
}

// ---- Extension point for the AI triage (step 7) ----------------------------

export type TriageDecision =
  | { kind: "program"; programId: string; confidence: number }
  | { kind: "ignore"; reason: "spam" | "hors_sujet" }
  | { kind: "uncertain" };

export type TriageFn = (mb: Mailbox, candidates: ProgramConfig[], p: ParsedInbound) => Promise<TriageDecision>;

let triageHook: TriageFn | null = null;
/** Step 7 registers the AI triage here. Until then a shared mailbox falls back. */
export function setTriageHook(fn: TriageFn | null): void {
  triageHook = fn;
}

// ---- Helpers ---------------------------------------------------------------

type Admin = SupabaseClient;

interface Ctx {
  admin: Admin;
  mb: Mailbox;
  programs: ProgramConfig[];
  folder: string;
  run: MailboxRun;
}

interface MsgMeta { folder: string; uid: number }

function synthId(source: Buffer): string {
  return `${createHash("sha1").update(source).digest("hex")}@no-message-id.invalid`;
}

async function event(
  ctx: Ctx,
  type: string,
  data: Record<string, unknown>,
  refs: { program_id?: string | null; thread_id?: string | null; contact_id?: string | null; message_id?: string | null } = {},
): Promise<void> {
  await ctx.admin.from("outreach_events").insert({
    program_id: refs.program_id ?? null,
    thread_id: refs.thread_id ?? null,
    contact_id: refs.contact_id ?? null,
    message_id: refs.message_id ?? null,
    actor: "imap",
    type,
    data,
  });
}

async function alreadyStored(admin: Admin, messageId: string): Promise<boolean> {
  const { data } = await admin.from("outreach_messages").select("id").eq("message_id", messageId).limit(1);
  return (data ?? []).length > 0;
}

interface ThreadRow {
  id: string;
  program_id: string;
  contact_id: string;
  address_id: string | null;
  status: string;
  closed_reason: string | null;
  needs_leo: boolean;
  first_inbound_at: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
}

async function loadThread(admin: Admin, id: string): Promise<ThreadRow | null> {
  const { data } = await admin
    .from("outreach_threads")
    .select("id, program_id, contact_id, address_id, status, closed_reason, needs_leo, first_inbound_at, first_response_at, sla_due_at")
    .eq("id", id)
    .maybeSingle<ThreadRow>();
  return data ?? null;
}

function attachmentsMeta(p: ParsedInbound) {
  return p.attachments.map((a) => ({ name: a.filename || null, size: a.size, type: a.contentType }));
}

function safeName(n: string): string {
  return (n || "fichier").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 80) || "fichier";
}

/** Copies images and PDFs (10 MB max) into outreach-files; best effort. */
async function storeAttachments(ctx: Ctx, threadId: string, rowId: string, p: ParsedInbound): Promise<void> {
  const meta: Record<string, unknown>[] = [];
  let stored = false;
  for (const a of p.attachments) {
    const entry: Record<string, unknown> = { name: a.filename || null, size: a.size, type: a.contentType };
    if (a.content && STORABLE.has(a.contentType) && a.size > 0 && a.size <= MAX_ATTACH_BYTES) {
      const path = `threads/${threadId}/${rowId}/${meta.length}-${safeName(a.filename)}`;
      const { error } = await ctx.admin.storage
        .from("outreach-files")
        .upload(path, a.content, { contentType: a.contentType, upsert: true });
      if (!error) { entry.path = path; stored = true; }
    }
    meta.push(entry);
  }
  if (stored) await ctx.admin.from("outreach_messages").update({ attachments: meta }).eq("id", rowId);
}

async function insertMessage(ctx: Ctx, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await ctx.admin.from("outreach_messages").insert(row).select("id").single<{ id: string }>();
  if (error) {
    if (error.code === "23505") { ctx.run.duplicates++; return null; }
    throw new Error(`insert message failed: ${error.code ?? ""}`);
  }
  return data.id;
}

function baseInbound(p: ParsedInbound, messageId: string, meta: MsgMeta, threadId: string) {
  return {
    thread_id: threadId,
    direction: "in",
    message_id: messageId,
    in_reply_to: p.inReplyTo,
    references_ids: p.references,
    from_email: p.fromEmail,
    to_email: p.toEmails[0] ?? null,
    cc_emails: p.ccEmails,
    subject: p.subject.slice(0, 500) || null,
    body_text: p.text.slice(0, MAX_BODY),
    attachments: attachmentsMeta(p),
    imap_folder: meta.folder,
    imap_uid: meta.uid,
    received_at: (p.date ?? new Date()).toISOString(),
  };
}

// ---- Thread effects --------------------------------------------------------

async function afterHumanReply(
  ctx: Ctx, t: ThreadRow, m: MatchResult, p: ParsedInbound, reply: string, msgRowId: string,
): Promise<void> {
  const program = ctx.programs.find((x) => x.id === t.program_id);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { last_inbound_at: nowIso, first_inbound_at: t.first_inbound_at ?? nowIso };

  if (program) {
    const cur = stageBySlug(program, t.status);
    const conv = stageByRole(program, "conversation");
    if (cur && conv) {
      const reopen = cur.role === "clos"
        && !["ne_plus_ecrire", "rebond", "doublon"].includes(t.closed_reason ?? "");
      const move = cur.role === "attente" || cur.role === "relance" || cur.role === "resolu" || reopen;
      if (move && canTransition(program, cur.slug, conv.slug, "imap")) {
        patch.status = conv.slug;
        patch.closed_reason = null;
      }
    }
    if (program.direction === "entrant" && !t.sla_due_at && !t.first_response_at && program.settings) {
      patch.sla_due_at = new Date(Date.now() + program.settings.sla_first_response_hours * 3_600_000).toISOString();
    }
  }

  // Flag for Leo until the AI reading (step 7) takes over the classification.
  let reason: NeedsLeoReason = "ia_indisponible";
  if (m.method === "adresse") reason = "rattachement_incertain";
  if (hasOptOutKeyword(reply)) {
    reason = "refus";
    await event(ctx, "reply.opt_out", { detected_by: "mots_cles" },
      { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: msgRowId });
  }
  if (!t.needs_leo || reason === "refus") {
    patch.needs_leo = true;
    patch.needs_leo_reason = reason;
    patch.needs_leo_since = nowIso;
  }
  const { error } = await ctx.admin.from("outreach_threads").update(patch).eq("id", t.id);
  if (error) throw new Error(`thread update failed: ${error.code ?? ""}`);

  // The person wrote from this address: it is theirs.
  if (p.fromEmail) {
    await ctx.admin.from("outreach_addresses").update({ verified_at: nowIso })
      .eq("contact_id", t.contact_id).eq("email", p.fromEmail).is("verified_at", null);
  }
}

async function handleHumanMatched(ctx: Ctx, p: ParsedInbound, mid: string, meta: MsgMeta, m: MatchResult): Promise<void> {
  const t = await loadThread(ctx.admin, m.threadId);
  if (!t) { ctx.run.ignored++; return; }
  const { reply } = extractReply(p.text);
  const id = await insertMessage(ctx, {
    ...baseInbound(p, mid, meta, t.id),
    kind: "entrant",
    reply_to_message_id: m.replyToMessageId,
    body_reply: reply || p.text.slice(0, MAX_BODY),
    match_method: m.method,
  });
  if (!id) return;
  ctx.run.stored++;
  await afterHumanReply(ctx, t, m, p, reply, id);
  await storeAttachments(ctx, t.id, id, p);
  await event(ctx, "inbound.received", { match_method: m.method },
    { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: id });
}

async function handleAutoMatched(ctx: Ctx, p: ParsedInbound, mid: string, meta: MsgMeta, m: MatchResult, header: string): Promise<void> {
  const t = await loadThread(ctx.admin, m.threadId);
  if (!t) { ctx.run.ignored++; return; }
  const id = await insertMessage(ctx, {
    ...baseInbound(p, mid, meta, t.id),
    kind: "entrant_auto",
    reply_to_message_id: m.replyToMessageId,
    body_reply: null,
    match_method: m.method,
  });
  if (!id) return;
  ctx.run.stored++;
  // No stage change, no last_inbound_at (human replies only), follow-up stays scheduled.
  await event(ctx, "inbound.auto_reply", { match_method: m.method, header },
    { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: id });
}

async function ignore(ctx: Ctx, reason: string): Promise<void> {
  ctx.run.ignored++;
  // Personal mailbox: a counter only. Service mailbox: an event without sender.
  if (!ctx.mb.personal) await event(ctx, "inbound.ignored", { raison: reason, mailbox: ctx.mb.key });
}

// ---- Bounces and complaints ------------------------------------------------

async function findThreadForBounce(
  ctx: Ctx, info: { originalMessageId: string | null },
): Promise<ThreadRow | null> {
  if (!info.originalMessageId) return null;
  const { data } = await ctx.admin.from("outreach_messages").select("thread_id")
    .eq("message_id", info.originalMessageId).eq("direction", "out").maybeSingle<{ thread_id: string }>();
  if (!data) return null;
  const t = await loadThread(ctx.admin, data.thread_id);
  const prog = t && ctx.programs.find((x) => x.id === t.program_id);
  return t && prog?.mailbox_key === ctx.mb.key ? t : null;
}

interface AddrRow { id: string; email: string; soft_bounces: number; status: string }

async function handleBounce(ctx: Ctx, p: ParsedInbound, mid: string, meta: MsgMeta,
  b: Extract<TransportInfo, { nature: "rebond" }>): Promise<void> {
  const t = await findThreadForBounce(ctx, b);
  if (!t) { await ignore(ctx, "rebond_sans_fil"); return; }

  const id = await insertMessage(ctx, {
    ...baseInbound(p, mid, meta, t.id),
    kind: "rebond",
    body_text: p.text.slice(0, 5000),
    attachments: [],
    match_method: "references",
  });
  if (!id) return;
  ctx.run.stored++;
  ctx.run.bounces++;

  // Address of the bounce: Final-Recipient, else the thread's own address.
  let addr: AddrRow | null = null;
  if (b.recipient) {
    const { data } = await ctx.admin.from("outreach_addresses").select("id, email, soft_bounces, status")
      .eq("contact_id", t.contact_id).eq("email", b.recipient).maybeSingle<AddrRow>();
    addr = data ?? null;
  }
  if (!addr && t.address_id) {
    const { data } = await ctx.admin.from("outreach_addresses").select("id, email, soft_bounces, status")
      .eq("id", t.address_id).maybeSingle<AddrRow>();
    addr = data ?? null;
  }
  const nowIso = new Date().toISOString();
  let hard = b.severity === "hard";

  if (addr && b.severity === "soft") {
    const soft = addr.soft_bounces + 1;
    if (soft >= SOFT_BOUNCE_LIMIT) hard = true;
    else {
      await ctx.admin.from("outreach_addresses")
        .update({ soft_bounces: soft, status: addr.status === "valide" ? "rebond_temporaire" : addr.status, status_at: nowIso })
        .eq("id", addr.id);
    }
  }

  if (hard && addr) {
    await ctx.admin.from("outreach_addresses").update({ status: "invalide", status_at: nowIso }).eq("id", addr.id);
    await ctx.admin.from("outreach_suppressions").upsert(
      { email: addr.email, reason: "rebond", source: "imap", thread_id: t.id },
      { onConflict: "email", ignoreDuplicates: true });
    // Close the thread when the contact has no other valid address.
    const { data: others } = await ctx.admin.from("outreach_addresses").select("id")
      .eq("contact_id", t.contact_id).neq("id", addr.id).in("status", ["valide", "rebond_temporaire"]).limit(1);
    const program = ctx.programs.find((x) => x.id === t.program_id);
    const closed = program ? stageByRole(program, "clos") : null;
    if ((others ?? []).length === 0 && program && closed
        && canTransition(program, t.status, closed.slug, "imap", "rebond")) {
      await ctx.admin.from("outreach_threads").update({ status: closed.slug, closed_reason: "rebond" }).eq("id", t.id);
    }
  }

  await event(ctx, hard ? "bounce.hard" : "bounce.soft", { status: b.status, diagnostic: b.diagnostic },
    { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: id });
}

async function handleComplaint(ctx: Ctx, p: ParsedInbound, mid: string, meta: MsgMeta,
  c: Extract<TransportInfo, { nature: "plainte" }>): Promise<void> {
  const t = await findThreadForBounce(ctx, c);

  // The complaint is about this mailbox: pause it whether or not the thread is found.
  await ctx.admin.from("outreach_mailboxes")
    .update({ paused: true, pause_reason: "plainte reçue (retour de boucle)", paused_at: new Date().toISOString() })
    .eq("key", ctx.mb.key).eq("paused", false);
  await event(ctx, "pause.auto", { scope: "boite", reason: "plainte", mailbox: ctx.mb.key },
    { program_id: t?.program_id ?? null, thread_id: t?.id ?? null });

  if (!t) { ctx.run.ignored++; return; }
  const id = await insertMessage(ctx, {
    ...baseInbound(p, mid, meta, t.id),
    kind: "plainte",
    body_text: p.text.slice(0, 5000),
    attachments: [],
    match_method: "references",
  });
  if (!id) return;
  ctx.run.stored++;

  if (c.recipient) {
    await ctx.admin.from("outreach_suppressions").upsert(
      { email: c.recipient, reason: "plainte", source: "fbl", thread_id: t.id },
      { onConflict: "email", ignoreDuplicates: true });
  }
  await optOutContact(ctx.admin, { contactId: t.contact_id, threadId: t.id, source: "plainte" });
  await event(ctx, "complaint.received", { source: "fbl" },
    { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: id });
}

// ---- New thread in a service mailbox (spec 6.5) ---------------------------------

async function openNewThread(ctx: Ctx, p: ParsedInbound, mid: string, meta: MsgMeta): Promise<void> {
  if (!p.fromEmail) { await ignore(ctx, "sans_expediteur"); return; }
  const candidates = ctx.programs.filter(
    (x) => x.mailbox_key === ctx.mb.key && x.direction === "entrant" && x.active);
  if (candidates.length === 0) { await ignore(ctx, "aucun_programme"); return; }

  let target = candidates[0];
  let uncertain = false;
  let confidence: number | null = null;
  if (candidates.length > 1) {
    const d: TriageDecision = triageHook ? await triageHook(ctx.mb, candidates, p) : { kind: "uncertain" };
    if (d.kind === "ignore") { await ignore(ctx, d.reason); return; }
    const chosen = d.kind === "program" ? candidates.find((x) => x.id === d.programId) : undefined;
    if (chosen && d.kind === "program" && d.confidence >= Number(ctx.mb.triage_threshold)) {
      target = chosen;
      confidence = d.confidence;
    } else {
      // Uncertain: the mailbox fallback, else the first candidate; Leo redirects.
      target = candidates.find((x) => x.id === ctx.mb.fallback_program_id) ?? candidates[0];
      uncertain = true;
      confidence = d.kind === "program" ? d.confidence : null;
    }
  }

  const { reply } = extractReply(p.text);
  const entry = {
    version: "1",
    program: target.slug,
    source: "mail",
    contact: { nom: p.fromName ?? p.fromEmail.split("@")[0] },
    adresse: { email: p.fromEmail, personne: p.fromName ?? undefined },
    message: {
      message_id: mid,
      in_reply_to: p.inReplyTo,
      references: p.references,
      texte: p.text.slice(0, 20_000),
      reponse: (reply || p.text).slice(0, 20_000),
      objet: p.subject,
      recu_le: (p.date ?? new Date()).toISOString(),
      pieces_jointes: attachmentsMeta(p),
    },
    tri: { incertain: uncertain, confiance: confidence },
  };
  const { data, error } = await ctx.admin.rpc("outreach_open_inbound", { p_entry: entry });
  if (error) {
    // Refused (source not accepted, invalid address...): keep the cursor moving.
    await ignore(ctx, "ouverture_refusee");
    return;
  }
  const res = data as { thread_id?: string; message_id?: string | null; cree?: boolean; motif?: string };
  if (res.motif === "deja_recu") { ctx.run.duplicates++; return; }
  ctx.run.stored++;
  if (res.message_id && res.thread_id) {
    await ctx.admin.from("outreach_messages")
      .update({ imap_folder: meta.folder, imap_uid: meta.uid }).eq("id", res.message_id);
    await storeAttachments(ctx, res.thread_id, res.message_id, p);
  }
  await event(ctx, "inbound.received", { match_method: "nouveau_fil", tri_incertain: uncertain },
    { program_id: target.id, thread_id: res.thread_id ?? null, message_id: res.message_id ?? null });
}

// ---- Dispatch --------------------------------------------------------------

async function handleInbox(ctx: Ctx, raw: RawMessage): Promise<void> {
  ctx.run.read++;
  let p: ParsedInbound;
  try {
    p = await parseRaw(raw.source);
  } catch {
    await ignore(ctx, "illisible");
    return;
  }
  const mid = p.messageId ?? synthId(raw.source);
  if (await alreadyStored(ctx.admin, mid)) { ctx.run.duplicates++; return; }
  const meta: MsgMeta = { folder: ctx.folder, uid: raw.uid };
  const tr = classifyTransport(p);

  if (tr.nature === "rebond") return handleBounce(ctx, p, mid, meta, tr);
  if (tr.nature === "plainte") return handleComplaint(ctx, p, mid, meta, tr);

  const m = await matchThread(ctx.mb.key, p);
  if (tr.nature === "auto") {
    if (m) return handleAutoMatched(ctx, p, mid, meta, m, tr.header);
    return ignore(ctx, "reponse_automatique");
  }
  if (m) return handleHumanMatched(ctx, p, mid, meta, m);
  if (ctx.mb.personal) { ctx.run.ignored++; return; }
  if (tr.spam) return ignore(ctx, "spam");
  if (tr.bulk) return ignore(ctx, "envoi_de_masse");
  return openNewThread(ctx, p, mid, meta);
}

/** "Envoyés": a reply written by Leo outside the admin (spec 6.4). */
async function handleSent(ctx: Ctx, raw: RawMessage): Promise<void> {
  ctx.run.read++;
  let p: ParsedInbound;
  try { p = await parseRaw(raw.source); } catch { ctx.run.ignored++; return; }
  const mid = p.messageId ?? synthId(raw.source);
  if (await alreadyStored(ctx.admin, mid)) { ctx.run.duplicates++; return; } // sent by the admin, or replay
  const m = await matchByHeaders(ctx.mb.key, p);
  if (!m) { ctx.run.ignored++; return; }
  const t = await loadThread(ctx.admin, m.threadId);
  if (!t) { ctx.run.ignored++; return; }

  const sentAt = (p.date ?? new Date()).toISOString();
  const id = await insertMessage(ctx, {
    thread_id: t.id,
    direction: "out",
    kind: "hors_admin",
    message_id: mid,
    in_reply_to: p.inReplyTo,
    references_ids: p.references,
    reply_to_message_id: m.replyToMessageId,
    from_email: p.fromEmail,
    to_email: p.toEmails[0] ?? null,
    cc_emails: p.ccEmails,
    subject: p.subject.slice(0, 500) || null,
    body_text: p.text.slice(0, MAX_BODY),
    attachments: attachmentsMeta(p),
    imap_folder: ctx.folder,
    imap_uid: raw.uid,
    sent_at: sentAt,
    send_status: "envoye",
    author: "leo",
    match_method: "leo",
  });
  if (!id) return;
  ctx.run.stored++;

  // Leo answered by hand: the streak restarts and the "à toi" flag is lowered.
  const program = ctx.programs.find((x) => x.id === t.program_id);
  const patch: Record<string, unknown> = { auto_streak: 0, needs_leo: false, needs_leo_reason: null, needs_leo_since: null };
  if (program?.direction === "entrant" && t.first_inbound_at && !t.first_response_at) patch.first_response_at = sentAt;
  if (program) {
    const cur = stageBySlug(program, t.status);
    const conv = stageByRole(program, "conversation");
    if (cur?.role === "nouveau" && conv) patch.status = conv.slug; // recu -> en_cours, allowed by the table
  }
  let { error } = await ctx.admin.from("outreach_threads").update(patch).eq("id", t.id);
  if (error && patch.status) {
    delete patch.status;
    ({ error } = await ctx.admin.from("outreach_threads").update(patch).eq("id", t.id));
  }
  if (error) throw new Error(`thread update failed: ${error.code ?? ""}`);
  await event(ctx, "inbound.hors_admin", { match_method: m.method },
    { program_id: t.program_id, thread_id: t.id, contact_id: t.contact_id, message_id: id });
}

// ---- Run -------------------------------------------------------------------

async function readState(admin: Admin, key: string, folder: string): Promise<FolderState> {
  const { data } = await admin.from("outreach_mailbox_state").select("uidvalidity, last_uid")
    .eq("mailbox_key", key).eq("folder", folder)
    .maybeSingle<{ uidvalidity: number; last_uid: number }>();
  return data ? { uidvalidity: Number(data.uidvalidity), last_uid: Number(data.last_uid) } : { uidvalidity: null, last_uid: 0 };
}

async function writeState(
  admin: Admin, key: string, folder: string, uidvalidity: number, lastUid: number, err: string | null,
): Promise<void> {
  await admin.from("outreach_mailbox_state").upsert({
    mailbox_key: key, folder, uidvalidity, last_uid: lastUid,
    last_run_at: new Date().toISOString(), last_error: err,
  }, { onConflict: "mailbox_key,folder" });
}

export async function runMailbox(admin: Admin, mb: Mailbox, programs: ProgramConfig[]): Promise<MailboxRun> {
  const run: MailboxRun = {
    mailbox: mb.key, status: "ok", read: 0, stored: 0, ignored: 0, duplicates: 0, bounces: 0, errors: 0,
  };
  const cfg = imapConfigFor(mb.env_prefix);
  if (!cfg) return { ...run, status: "skipped", reason: "variables_imap_absentes" };

  try {
    await withImap(cfg, async (s) => {
      const sent = await s.resolveSentFolder(cfg.sentFolder).catch(() => null);
      const folders: { name: string; sent: boolean }[] = [{ name: "INBOX", sent: false }];
      if (sent && sent !== "INBOX") folders.push({ name: sent, sent: true });

      for (const f of folders) {
        const ctx: Ctx = { admin, mb, programs, folder: f.name, run };
        const state = await readState(admin, mb.key, f.name);
        const res = await s.readFolder(f.name, state, BATCH_PER_FOLDER, (raw) =>
          f.sent ? handleSent(ctx, raw) : handleInbox(ctx, raw));
        const errText = res.failed ? safeMessage(res.failed) : null;
        await writeState(admin, mb.key, f.name, res.uidValidity, res.lastUid, errText);
        if (res.failed) { run.errors++; run.status = "error"; run.reason = errText ?? "erreur"; }
      }
    });
  } catch (err) {
    run.status = "error";
    run.errors++;
    run.reason = safeMessage(err);
  }
  return run;
}

/** All active mailboxes, one after the other. */
export async function runInbox(): Promise<{ runs: MailboxRun[]; configured: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { runs: [], configured: false };
  const { data } = await admin.from("outreach_mailboxes").select("*").eq("active", true).order("key");
  const boxes = (data ?? []) as Mailbox[];
  const programs = await getProgramConfigs();
  const runs: MailboxRun[] = [];
  for (const mb of boxes) runs.push(await runMailbox(admin, mb, programs));
  return { runs, configured: true };
}
