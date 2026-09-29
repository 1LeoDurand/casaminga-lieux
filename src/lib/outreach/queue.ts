import "server-only";
/**
 * Send queue of the contacts module (spec 5.1 to 5.4). One pass = for every
 * active mailbox: health check, then the due `planifie` messages in the order
 * replies (Leo, then automatic), follow-ups, first contacts, within the
 * sending window, the mailbox's absolute cap, the program's cold cap and ramp,
 * and the per-run cap. Then the copies in "Envoyés", then the delay tasks
 * (close without follow-up, late first response, resolved threads).
 *
 * Concurrency: a message is taken by `update ... where send_status = 'planifie'`,
 * atomic in Postgres: two simultaneous runs cannot both take it, so it leaves
 * once. The database trigger `outreach_guard_outbound` checks every rule again
 * at that moment (opt-out, invalid address, closed thread, pause, inactive...).
 *
 * Nothing here writes an address or a mail body into a log or an event.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/guard";
import { getProgramConfigs } from "./programs";
import { canTransition, stageByRole, stageBySlug } from "./status";
import {
  actionBlock, buildBodies, cleanAddress, cleanHeader, identityLine as makeIdentityLine, type LinkAction,
} from "./compose";
import { alertAdmin, checkMailboxHealth } from "./health";
import { appendManyToSent, composeRaw, outreachMailConfig, scrub, sendRaw, type AppendItem, type MailboxConfig } from "./mailer";
import { contactActionUrl, contactStopApiUrl } from "./link-token";
import { coldCapForDay, nextSendSlot, sendWindowOpen, startOfLocalDay } from "./schedule";
import type { Mailbox, Message, ProgramConfig, Thread } from "./types";

const RETRY_MINUTES = 30;
const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 15;
const DUE_LIMIT = 300;
const APPEND_RETRY_LIMIT = 20;
const APPEND_RETRY_DAYS = 7;
const MAX_CONSECUTIVE_TEMP_FAILURES = 3;
const PROBE_THREAD = "00000000-0000-0000-0000-000000000000";
const COLD_KINDS = new Set(["initial", "relance"]);

type Admin = SupabaseClient;

export interface MailboxRun {
  mailbox: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  sent: number;
  deferred: number;
  failed: number;
  cancelled: number;
  appended: number;
  paused: boolean;
}

export interface DelayRun {
  closedNoReply: number;
  slaFlagged: number;
  resolvedClosed: number;
}

/** Columns of outreach_messages that the shared `Message` type does not carry. */
interface QueueColumns {
  reply_to_message_id: string | null;
  in_reply_to: string | null;
  references_ids: string[] | null;
  send_attempts: number;
}

interface DueRow extends Message, QueueColumns {
  outreach_threads: Thread;
}

type Outcome = "sent" | "deferred" | "failed" | "cancelled" | "stop";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function event(
  admin: Admin,
  type: string,
  data: Record<string, unknown>,
  refs: { program_id?: string | null; thread_id?: string | null; contact_id?: string | null; message_id?: string | null } = {},
): Promise<void> {
  // Never an address nor a mail body in `data` (spec 3.5).
  const { error } = await admin.from("outreach_events").insert({
    program_id: refs.program_id ?? null,
    thread_id: refs.thread_id ?? null,
    contact_id: refs.contact_id ?? null,
    message_id: refs.message_id ?? null,
    actor: "cron",
    type,
    data,
  });
  if (error) console.error("[outreach-send] event not written:", type, error.code);
}

function rank(m: Message): number {
  if (m.kind === "reponse") return m.author === "leo" ? 0 : 1;
  if (m.kind === "relance") return 2;
  return 3;
}

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

function subjectFor(msg: Pick<Message, "subject" | "kind">, thread: Thread): string {
  const base = cleanHeader(msg.subject || thread.email_subject || "");
  if (msg.kind === "relance" && !/^re\s*:/i.test(base)) return `Re: ${base}`;
  return base;
}

/** Threading headers: reply -> the inbound it answers, follow-up -> the first mail of the thread. */
async function threadingFor(admin: Admin, msg: DueRow): Promise<{ inReplyTo: string | null; references: string[] }> {
  if (msg.kind === "reponse" && msg.reply_to_message_id) {
    const { data } = await admin.from("outreach_messages")
      .select("message_id, references_ids").eq("id", msg.reply_to_message_id).maybeSingle<{ message_id: string | null; references_ids: string[] | null }>();
    if (data?.message_id) return { inReplyTo: data.message_id, references: [...(data.references_ids ?? []), data.message_id].slice(-20) };
  }
  if (msg.kind === "relance") {
    const { data } = await admin.from("outreach_messages")
      .select("message_id").eq("thread_id", msg.thread_id).eq("kind", "initial").eq("send_status", "envoye")
      .not("message_id", "is", null).order("sent_at", { ascending: true }).limit(1).maybeSingle<{ message_id: string | null }>();
    if (data?.message_id) return { inReplyTo: data.message_id, references: [data.message_id] };
  }
  return { inReplyTo: null, references: [] };
}

interface MailContext {
  placeName: string;
  articleTitle: string | null;
  addrSource: string | null;
  addrSourceUrl: string | null;
}

async function loadMailContext(admin: Admin, thread: Thread, toEmail: string): Promise<MailContext> {
  const [c, a, art] = await Promise.all([
    admin.from("outreach_contacts").select("name").eq("id", thread.contact_id).maybeSingle<{ name: string }>(),
    thread.address_id
      ? admin.from("outreach_addresses").select("source, source_url").eq("id", thread.address_id).maybeSingle<{ source: string; source_url: string | null }>()
      : admin.from("outreach_addresses").select("source, source_url").eq("contact_id", thread.contact_id).eq("email", toEmail).maybeSingle<{ source: string; source_url: string | null }>(),
    thread.article_id
      ? admin.from("outreach_articles").select("title").eq("id", thread.article_id).maybeSingle<{ title: string }>()
      : Promise.resolve({ data: null }),
  ]);
  return {
    placeName: c.data?.name ?? "votre lieu",
    articleTitle: (art.data as { title: string } | null)?.title ?? null,
    addrSource: a.data?.source ?? null,
    addrSourceUrl: a.data?.source_url ?? null,
  };
}

/** Builds the raw message. Used for the send and, identically, for a retried copy in "Envoyés". */
async function buildRaw(
  admin: Admin,
  cfg: MailboxConfig,
  program: ProgramConfig,
  thread: Thread,
  msg: DueRow,
  headers: { messageId: string; inReplyTo: string | null; references: string[] },
  toEmail: string,
  sentAt: Date,
): Promise<Buffer> {
  const ctx = await loadMailContext(admin, thread, toEmail);
  const issued = sentAt.getTime();
  const links: Partial<Record<LinkAction, string | null>> = {};
  for (const a of program.link_actions) links[a as LinkAction] = contactActionUrl(thread.id, a as LinkAction, issued);
  const block = actionBlock(program, links);
  const cold = COLD_KINDS.has(msg.kind);
  const identity = program.direction === "sortant" && cold
    ? makeIdentityLine({
        form: program.address_form, place: ctx.placeName, articleTitle: ctx.articleTitle,
        source: ctx.addrSource, sourceUrl: ctx.addrSourceUrl,
      })
    : null;
  const { text, html } = buildBodies({
    body: msg.body_text ?? "", block, signature: program.signature, identityLine: identity,
  });
  const unsubscribeUrl = program.direction === "sortant" && program.link_actions.includes("stop")
    ? contactStopApiUrl(thread.id, issued)
    : null;
  return composeRaw({
    messageId: headers.messageId,
    fromName: program.sender_name,
    fromAddress: cfg.address,
    to: toEmail,
    subject: subjectFor(msg, thread),
    text, html,
    inReplyTo: headers.inReplyTo,
    references: headers.references,
    unsubscribeUrl,
    unsubscribeMailto: unsubscribeUrl ? cfg.address : null,
    date: sentAt,
  });
}

// ---------------------------------------------------------------------------
// One message
// ---------------------------------------------------------------------------

interface Usage {
  total: number;
  cold: Map<string, number>;
  runCold: Map<string, number>;
}

interface Batch {
  admin: Admin;
  mb: Mailbox;
  cfg: MailboxConfig;
  programs: Map<string, ProgramConfig>;
  now: Date;
  usage: Usage;
  linksAvailable: boolean;
  appendItems: (AppendItem & { threadId: string })[];
  run: MailboxRun;
}

async function cancel(b: Batch, msg: DueRow, program: ProgramConfig, why: string): Promise<Outcome> {
  const { data } = await b.admin.from("outreach_messages").update({ send_status: "annule", send_error: why })
    .eq("id", msg.id).in("send_status", ["planifie", "en_cours"]).select("id");
  if ((data ?? []).length > 0) {
    await event(b.admin, "message.cancelled", { kind: msg.kind, why }, {
      program_id: program.id, thread_id: msg.thread_id, contact_id: msg.outreach_threads.contact_id, message_id: msg.id,
    });
  }
  return "cancelled";
}

async function flagNeedsLeo(admin: Admin, threadId: string, reason: "envoi_bloque" | "autre"): Promise<void> {
  await admin.from("outreach_threads")
    .update({ needs_leo: true, needs_leo_reason: reason, needs_leo_since: new Date().toISOString() })
    .eq("id", threadId).eq("needs_leo", false);
}

/** Moves the thread to the stage that follows a successful send, and stamps its dates. */
async function afterSent(b: Batch, msg: DueRow, program: ProgramConfig, sentAt: Date): Promise<void> {
  const { admin } = b;
  const { data: fresh } = await admin.from("outreach_threads").select("*").eq("id", msg.thread_id).maybeSingle<Thread>();
  if (!fresh) return;
  const role = stageBySlug(program, fresh.status)?.role;
  const iso = sentAt.toISOString();
  const patch: Record<string, unknown> = { last_outbound_at: iso };
  if (!fresh.first_sent_at) patch.first_sent_at = iso;
  if (program.direction === "entrant" && !fresh.first_response_at && msg.kind === "reponse") patch.first_response_at = iso;
  if (msg.author === "auto") patch.auto_streak = fresh.auto_streak + 1;
  if (msg.kind === "relance") patch.follow_up_count = Math.min(1, fresh.follow_up_count + 1);

  let target: string | null = null;
  if (msg.kind === "initial" && role === "planifie") target = stageByRole(program, "attente")?.slug ?? null;
  else if (msg.kind === "relance" && role === "attente") target = stageByRole(program, "relance")?.slug ?? null;
  else if (msg.kind === "reponse" && program.direction === "entrant" && role === "nouveau") target = stageByRole(program, "conversation")?.slug ?? null;

  if (target) {
    const { error } = await admin.from("outreach_threads").update({ ...patch, status: target })
      .eq("id", fresh.id).eq("status", fresh.status);
    if (!error) return;
    console.error("[outreach-send] stage not moved:", error.code);
  }
  await admin.from("outreach_threads").update(patch).eq("id", fresh.id);
}

/** After a first contact, the follow-up approved with it is planned at send + follow_up_after_days. */
async function planFollowUp(b: Batch, msg: DueRow, program: ProgramConfig, sentAt: Date): Promise<void> {
  if (msg.kind !== "initial" || program.direction !== "sortant" || !program.settings) return;
  const { admin } = b;
  const { data: rows } = await admin.from("outreach_messages").select("id")
    .eq("thread_id", msg.thread_id).eq("kind", "relance").eq("send_status", "a_valider").not("approved_at", "is", null).limit(1);
  const follow = (rows ?? [])[0] as { id: string } | undefined;
  if (!follow) return;
  if (program.settings.max_follow_ups < 1) {
    await admin.from("outreach_messages").update({ send_status: "annule", send_error: "relances coupées" }).eq("id", follow.id);
    return;
  }
  const at = nextSendSlot(addMinutes(sentAt, program.settings.follow_up_after_days * 1440), program.settings);
  const { error } = await admin.from("outreach_messages")
    .update({ send_status: "planifie", scheduled_for: at.toISOString() })
    .eq("id", follow.id).eq("send_status", "a_valider");
  if (error) {
    console.error("[outreach-send] follow-up not planned:", error.code);
    return;
  }
  await event(admin, "message.queued", { kind: "relance", author: "leo", scheduled_for: at.toISOString() }, {
    program_id: program.id, thread_id: msg.thread_id, contact_id: msg.outreach_threads.contact_id, message_id: follow.id,
  });
}

async function logEmail(admin: Admin, program: ProgramConfig, subject: string, to: string, status: "sent" | "failed", error?: string): Promise<void> {
  try {
    await admin.from("email_log").insert({
      organization_id: null,
      recipient: to,
      subject,
      category: program.direction === "sortant" ? "prospection" : "support",
      status,
      error: error ?? null,
    });
  } catch {
    /* the journal never breaks a send */
  }
}

async function hardFailure(b: Batch, msg: DueRow, program: ProgramConfig, toEmail: string, code: number | undefined): Promise<void> {
  const { admin } = b;
  const nowIso = new Date().toISOString();
  const thread = msg.outreach_threads;
  await admin.from("outreach_suppressions").upsert(
    { email: toEmail, reason: "rebond", source: "smtp", thread_id: thread.id },
    { onConflict: "email", ignoreDuplicates: true },
  );
  await admin.from("outreach_addresses").update({ status: "invalide", status_at: nowIso }).eq("email", toEmail);
  await event(admin, "bounce.hard", { status: "smtp", code: code ?? null }, {
    program_id: program.id, thread_id: thread.id, contact_id: thread.contact_id, message_id: msg.id,
  });
  const { data: others } = await admin.from("outreach_addresses").select("id")
    .eq("contact_id", thread.contact_id).in("status", ["valide", "rebond_temporaire"]).neq("email", toEmail).limit(1);
  if ((others ?? []).length > 0) return;
  const { data: fresh } = await admin.from("outreach_threads").select("status").eq("id", thread.id).maybeSingle<{ status: string }>();
  const clos = stageByRole(program, "clos");
  if (fresh && clos && canTransition(program, fresh.status, clos.slug, "cron", "rebond")) {
    await admin.from("outreach_threads").update({ status: clos.slug, closed_reason: "rebond" }).eq("id", thread.id).eq("status", fresh.status);
  } else {
    await flagNeedsLeo(admin, thread.id, "autre");
  }
}

async function sendOne(b: Batch, msg: DueRow, program: ProgramConfig): Promise<Outcome> {
  const { admin, cfg, mb } = b;
  const thread = msg.outreach_threads;
  const settings = program.settings!;
  const cold = COLD_KINDS.has(msg.kind);

  // A follow-up that is no longer due is cancelled here, before the database guard says the same.
  if (msg.kind === "relance") {
    const role = stageBySlug(program, thread.status)?.role;
    if (role !== "attente" || thread.last_inbound_at || thread.follow_up_count >= settings.max_follow_ups) {
      return cancel(b, msg, program, "relance_caduque");
    }
  }
  const to = cleanAddress(msg.to_email ?? "");
  if (!to) return cancel(b, msg, program, "destinataire_invalide");

  const { inReplyTo, references } = await threadingFor(admin, msg);
  const messageId = msg.message_id ?? `o.${msg.id}@${cfg.domain}`;
  const subject = subjectFor(msg, thread);

  // Take the message. The Message-ID and headers are recorded BEFORE the send.
  const { data: taken, error: takeError } = await admin.from("outreach_messages")
    .update({
      send_status: "en_cours", message_id: messageId, in_reply_to: inReplyTo, references_ids: references,
      from_email: cfg.address, subject,
    })
    .eq("id", msg.id).eq("send_status", "planifie").select("id");
  if (takeError) {
    const text = takeError.message ?? "";
    if (text.includes("outreach guard:")) {
      // Paused or inactive: it stays in the queue. Anything else is a rule that will not change.
      if (/paused|inactive/.test(text)) return "deferred";
      return cancel(b, msg, program, "garde_" + text.replace(/^.*outreach guard:\s*/, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 40));
    }
    console.error("[outreach-send] take failed:", takeError.code);
    b.run.failed++;
    return "failed";
  }
  if (!taken || taken.length === 0) return "deferred"; // another run took it

  const sentAt = new Date();
  let raw: Buffer;
  try {
    raw = await buildRaw(admin, cfg, program, thread, msg, { messageId, inReplyTo, references }, to, sentAt);
  } catch {
    await admin.from("outreach_messages").update({ send_status: "planifie" }).eq("id", msg.id).eq("send_status", "en_cours");
    return "deferred";
  }

  const res = await sendRaw(cfg, raw, { from: cfg.address, to: [to] });
  const refs = { program_id: program.id, thread_id: thread.id, contact_id: thread.contact_id, message_id: msg.id };

  if (res.ok) {
    await admin.from("outreach_messages").update({
      send_status: "envoye", sent_at: sentAt.toISOString(), smtp_response: res.response ?? null, send_error: null,
      send_attempts: msg.send_attempts + 1,
    }).eq("id", msg.id);
    await event(admin, "message.sent", { kind: msg.kind, author: msg.author, smtp_code: 250 }, refs);
    await logEmail(admin, program, subject, to, "sent");
    await afterSent(b, msg, program, sentAt);
    await planFollowUp(b, msg, program, sentAt);
    b.usage.total++;
    if (cold) {
      b.usage.cold.set(program.id, (b.usage.cold.get(program.id) ?? 0) + 1);
      b.usage.runCold.set(program.id, (b.usage.runCold.get(program.id) ?? 0) + 1);
    }
    b.appendItems.push({ id: msg.id, threadId: thread.id, raw, date: sentAt });
    b.run.sent++;
    return "sent";
  }

  const err = scrub(res.response ?? "", cfg);
  const attempts = msg.send_attempts + 1;
  await logEmail(admin, program, subject, to, "failed", err);

  if (res.kind === "auth") {
    await admin.from("outreach_messages").update({ send_status: "planifie" }).eq("id", msg.id).eq("send_status", "en_cours");
    await alertAdmin(admin, mb.key, "smtp_auth", "Envoi refusé : identifiants SMTP", "Le serveur refuse les identifiants d'envoi de cette boîte. Rien ne part tant que ce n'est pas corrigé.");
    b.run.status = "error";
    b.run.reason = "smtp_auth";
    return "stop";
  }
  if (res.kind === "temporary") {
    const final = attempts >= MAX_ATTEMPTS;
    await admin.from("outreach_messages").update({
      send_status: final ? "echec" : "planifie",
      scheduled_for: final ? msg.scheduled_for : addMinutes(new Date(), RETRY_MINUTES).toISOString(),
      send_attempts: attempts, send_error: err || "erreur temporaire",
    }).eq("id", msg.id);
    await event(admin, "message.failed", { kind: msg.kind, smtp_code: res.code ?? null, attempt: attempts, final }, refs);
    if (final) { await flagNeedsLeo(admin, thread.id, "envoi_bloque"); b.run.failed++; return "failed"; }
    b.run.deferred++;
    return "deferred";
  }
  // recipient / permanent: definitive.
  await admin.from("outreach_messages").update({
    send_status: "echec", send_attempts: attempts, send_error: err || "refus définitif",
  }).eq("id", msg.id);
  await event(admin, "message.failed", { kind: msg.kind, smtp_code: res.code ?? null, attempt: attempts, final: true, recipient: res.kind === "recipient" }, refs);
  if (res.kind === "recipient") await hardFailure(b, msg, program, to, res.code);
  else await flagNeedsLeo(admin, thread.id, "envoi_bloque");
  b.run.failed++;
  return "failed";
}

// ---------------------------------------------------------------------------
// One mailbox
// ---------------------------------------------------------------------------

async function flagStale(admin: Admin, mb: Mailbox, programIds: string[]): Promise<void> {
  const before = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data } = await admin.from("outreach_messages")
    .select("id, thread_id, outreach_threads!inner(program_id, contact_id, needs_leo_reason)")
    .eq("send_status", "en_cours").lt("updated_at", before)
    .in("outreach_threads.program_id", programIds).limit(20);
  type Stale = { id: string; thread_id: string; outreach_threads: { program_id: string; contact_id: string; needs_leo_reason: string | null } };
  let flagged = 0;
  for (const r of (data ?? []) as unknown as Stale[]) {
    // Never sent again automatically: the outcome is unknown, the mail may have left.
    if (r.outreach_threads.needs_leo_reason !== "envoi_bloque") {
      await admin.from("outreach_threads")
        .update({ needs_leo: true, needs_leo_reason: "envoi_bloque", needs_leo_since: new Date().toISOString() })
        .eq("id", r.thread_id);
      await event(admin, "message.failed", { why: "en_cours_bloque" }, {
        program_id: r.outreach_threads.program_id, thread_id: r.thread_id, contact_id: r.outreach_threads.contact_id, message_id: r.id,
      });
      flagged++;
    }
  }
  if (flagged > 0) {
    await alertAdmin(admin, mb.key, "envoi_bloque", "Un envoi est resté bloqué",
      "Au moins un message est resté « en cours » plus de 15 minutes. Il n'est pas renvoyé automatiquement : vérifie le dossier Envoyés avant de le relancer.");
  }
}

async function retryAppends(b: Batch, programIds: string[]): Promise<void> {
  const { admin, cfg } = b;
  if (!cfg.imap) return;
  const done = new Set(b.appendItems.map((i) => i.id));
  const since = new Date(b.now.getTime() - APPEND_RETRY_DAYS * 86_400_000).toISOString();
  const { data } = await admin.from("outreach_messages")
    .select("*, outreach_threads!inner(*)")
    .eq("direction", "out").eq("send_status", "envoye").eq("appended_to_sent", false)
    .gte("sent_at", since).in("outreach_threads.program_id", programIds)
    .order("sent_at", { ascending: true }).limit(APPEND_RETRY_LIMIT);
  for (const row of (data ?? []) as unknown as DueRow[]) {
    if (done.has(row.id) || !row.message_id || !row.sent_at || !row.to_email) continue;
    const program = b.programs.get(row.outreach_threads.program_id);
    if (!program) continue;
    try {
      const raw = await buildRaw(
        admin, cfg, program, row.outreach_threads, row,
        { messageId: row.message_id, inReplyTo: row.in_reply_to, references: row.references_ids ?? [] },
        row.to_email, new Date(row.sent_at),
      );
      b.appendItems.push({ id: row.id, threadId: row.thread_id, raw, date: new Date(row.sent_at) });
    } catch {
      /* rebuilt next time */
    }
  }
}

async function fileCopies(b: Batch): Promise<void> {
  if (b.appendItems.length === 0) return;
  const { admin, cfg } = b;
  if (!cfg.imap) {
    await alertAdmin(admin, b.mb.key, "imap_absent", "Pas de copie dans Envoyés",
      "Les variables IMAP de cette boîte sont absentes : les mails partent, mais aucune copie n'est déposée dans Envoyés.");
    return;
  }
  const res = await appendManyToSent(cfg, b.appendItems);
  for (const id of res.done) {
    await admin.from("outreach_messages").update({ appended_to_sent: true }).eq("id", id);
    const item = b.appendItems.find((i) => i.id === id);
    await event(admin, "message.appended", { folder: res.folder ? "sent" : null }, { thread_id: item?.threadId ?? null, message_id: id });
  }
  b.run.appended = res.done.length;
  if (res.done.length < b.appendItems.length) {
    // The send is never questioned; the copy is tried again at the next run.
    console.error("[outreach-send] copies to Sent pending:", b.appendItems.length - res.done.length, res.error ?? "");
  }
}

async function runMailbox(admin: Admin, mb0: Mailbox, programs: ProgramConfig[], now: Date): Promise<MailboxRun> {
  const run: MailboxRun = { mailbox: mb0.key, status: "ok", sent: 0, deferred: 0, failed: 0, cancelled: 0, appended: 0, paused: mb0.paused };
  const mine = programs.filter((p) => p.mailbox_key === mb0.key && p.active && p.settings);
  if (mine.length === 0) return { ...run, status: "skipped", reason: "aucun_programme_actif" };

  const cfg = outreachMailConfig(mb0);
  if (!cfg) {
    const { data } = await admin.from("outreach_v_mailbox_health").select("file_attente").eq("mailbox_key", mb0.key).maybeSingle<{ file_attente: number }>();
    if ((data?.file_attente ?? 0) > 0) {
      await alertAdmin(admin, mb0.key, "smtp_absent", "Variables d'envoi absentes",
        "Des messages attendent dans la file mais les variables SMTP de cette boîte sont absentes du serveur : rien ne part.");
    }
    return { ...run, status: "skipped", reason: "variables_smtp_absentes" };
  }

  const paused = await checkMailboxHealth(admin, mb0);
  const mb: Mailbox = paused ? { ...mb0, paused: true } : mb0;
  run.paused = paused;

  const programMap = new Map(mine.map((p) => [p.id, p]));
  const programIds = [...programMap.keys()];
  await flagStale(admin, mb, programIds);

  // Usage of today (Paris day for the mailbox cap, the program's zone for its cold cap).
  const usage: Usage = { total: 0, cold: new Map(), runCold: new Map() };
  const { data: sentEvents } = await admin.from("outreach_events").select("program_id, occurred_at, data")
    .eq("type", "message.sent").in("program_id", programIds)
    .gte("occurred_at", new Date(now.getTime() - 36 * 3_600_000).toISOString()).limit(3000);
  const mailboxDay = startOfLocalDay(now, "Europe/Paris").getTime();
  for (const e of (sentEvents ?? []) as { program_id: string; occurred_at: string; data: { kind?: string } }[]) {
    const at = new Date(e.occurred_at).getTime();
    if (at >= mailboxDay) usage.total++;
    const p = programMap.get(e.program_id);
    if (p?.settings && COLD_KINDS.has(e.data?.kind ?? "") && at >= startOfLocalDay(now, p.settings.timezone).getTime()) {
      usage.cold.set(p.id, (usage.cold.get(p.id) ?? 0) + 1);
    }
  }

  const b: Batch = {
    admin, mb, cfg, programs: programMap, now, usage,
    linksAvailable: contactActionUrl(PROBE_THREAD, "stop") !== null,
    appendItems: [], run,
  };

  const { data: due } = await admin.from("outreach_messages")
    .select("*, outreach_threads!inner(*)")
    .eq("direction", "out").eq("send_status", "planifie").lte("scheduled_for", now.toISOString())
    .in("outreach_threads.program_id", programIds)
    .order("scheduled_for", { ascending: true }).limit(DUE_LIMIT);
  const rows = ((due ?? []) as unknown as DueRow[])
    .sort((x, y) => rank(x) - rank(y) || (x.scheduled_for ?? "").localeCompare(y.scheduled_for ?? ""));

  let consecutiveTemp = 0;
  for (const msg of rows) {
    const program = programMap.get(msg.outreach_threads.program_id);
    const st = program?.settings;
    if (!program || !st) continue;
    const cold = COLD_KINDS.has(msg.kind);
    const auto = msg.author === "auto";

    // A pause stops cold mail and automatic replies, not Leo answering someone who wrote.
    if ((mb.paused || st.paused) && (cold || auto)) { run.deferred++; continue; }
    if (!sendWindowOpen(now, st)) { run.deferred++; continue; }
    if (usage.total >= mb.hard_daily_cap) { run.deferred++; continue; }
    if (cold && program.direction === "sortant") {
      // Without the signing secret the opt-out link cannot be built: no cold mail.
      if (!b.linksAvailable) { run.deferred++; continue; }
      if ((usage.cold.get(program.id) ?? 0) >= coldCapForDay(now, st)) { run.deferred++; continue; }
      if ((usage.runCold.get(program.id) ?? 0) >= st.per_run_cap) { run.deferred++; continue; }
    }

    const outcome = await sendOne(b, msg, program);
    if (outcome === "cancelled") run.cancelled++;
    else if (outcome === "deferred") { /* counted where it is decided */ }
    if (outcome === "stop") break;
    consecutiveTemp = outcome === "deferred" ? consecutiveTemp + 1 : 0;
    if (consecutiveTemp >= MAX_CONSECUTIVE_TEMP_FAILURES) break;
  }

  await retryAppends(b, programIds);
  await fileCopies(b);
  return run;
}

// ---------------------------------------------------------------------------
// Delay tasks (spec 5.1)
// ---------------------------------------------------------------------------

async function runDelayTasks(admin: Admin, programs: ProgramConfig[], now: Date): Promise<DelayRun> {
  const out: DelayRun = { closedNoReply: 0, slaFlagged: 0, resolvedClosed: 0 };
  const nowIso = now.toISOString();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  for (const program of programs) {
    const st = program.settings;
    if (!program.active || !st) continue;
    const clos = stageByRole(program, "clos");

    if (program.direction === "sortant" && clos) {
      for (const role of ["attente", "relance"] as const) {
        const stage = stageByRole(program, role);
        if (!stage || !canTransition(program, stage.slug, clos.slug, "cron", "sans_suite")) continue;
        const { data } = await admin.from("outreach_threads").select("id, contact_id")
          .eq("program_id", program.id).eq("status", stage.slug).is("last_inbound_at", null)
          .lt("first_sent_at", daysAgo(st.close_after_days)).limit(100);
        for (const t of (data ?? []) as { id: string; contact_id: string }[]) {
          const { data: moved } = await admin.from("outreach_threads")
            .update({ status: clos.slug, closed_reason: "sans_suite" }).eq("id", t.id).eq("status", stage.slug).select("id");
          if ((moved ?? []).length === 0) continue;
          await admin.from("outreach_messages").update({ send_status: "annule", send_error: "fil_clos_sans_suite" })
            .eq("thread_id", t.id).eq("direction", "out").in("send_status", ["a_valider", "planifie"]);
          out.closedNoReply++;
        }
      }
    }

    if (program.direction === "entrant") {
      const nouveau = stageByRole(program, "nouveau");
      if (nouveau) {
        const { data } = await admin.from("outreach_threads").select("id, contact_id, sla_due_at")
          .eq("program_id", program.id).eq("status", nouveau.slug).eq("needs_leo", false)
          .is("first_response_at", null).lt("sla_due_at", nowIso).limit(100);
        for (const t of (data ?? []) as { id: string; contact_id: string; sla_due_at: string }[]) {
          const { data: flagged } = await admin.from("outreach_threads")
            .update({ needs_leo: true, needs_leo_reason: "sla_depasse", needs_leo_since: nowIso })
            .eq("id", t.id).eq("needs_leo", false).select("id");
          if ((flagged ?? []).length === 0) continue;
          await event(admin, "sla.breached", { due_at: t.sla_due_at }, { program_id: program.id, thread_id: t.id, contact_id: t.contact_id });
          out.slaFlagged++;
        }
      }
      const resolu = stageByRole(program, "resolu");
      if (resolu && clos && canTransition(program, resolu.slug, clos.slug, "cron", "resolu")) {
        const { data } = await admin.from("outreach_threads").select("id")
          .eq("program_id", program.id).eq("status", resolu.slug).lt("status_changed_at", daysAgo(st.resolved_autoclose_days)).limit(100);
        for (const t of (data ?? []) as { id: string }[]) {
          const { data: moved } = await admin.from("outreach_threads")
            .update({ status: clos.slug, closed_reason: "resolu", resolved_at: nowIso }).eq("id", t.id).eq("status", resolu.slug).select("id");
          if ((moved ?? []).length > 0) out.resolvedClosed++;
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runSendQueue(now: Date = new Date()): Promise<{ configured: boolean; runs: MailboxRun[]; delays: DelayRun }> {
  const admin = createAdminClient();
  const none: DelayRun = { closedNoReply: 0, slaFlagged: 0, resolvedClosed: 0 };
  if (!admin) return { configured: false, runs: [], delays: none };

  const { data } = await admin.from("outreach_mailboxes").select("*").eq("active", true).order("key");
  const boxes = (data ?? []) as Mailbox[];
  const programs = await getProgramConfigs();
  const runs: MailboxRun[] = [];
  for (const mb of boxes) {
    try {
      runs.push(await runMailbox(admin, mb, programs, now));
    } catch (err) {
      // One mailbox failing must not stop the others. No detail: it could carry an address.
      console.error("[outreach-send] mailbox run failed:", mb.key, (err as { code?: string })?.code ?? "erreur");
      runs.push({ mailbox: mb.key, status: "error", reason: "exception", sent: 0, deferred: 0, failed: 0, cancelled: 0, appended: 0, paused: mb.paused });
    }
  }
  let delays = none;
  try {
    delays = await runDelayTasks(admin, programs, now);
  } catch {
    console.error("[outreach-send] delay tasks failed");
  }
  return { configured: true, runs, delays };
}
