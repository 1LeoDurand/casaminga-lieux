"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { getProgramConfig } from "@/lib/outreach/programs";
import { canTransition, stageByRole, stageBySlug, MANUAL_CLOSED_REASONS } from "@/lib/outreach/status";
import type {
  ActionResult, ClosedReason, Message, ProgramConfig, Subject, SubjectQualityRow, Thread,
} from "@/lib/outreach/types";

/**
 * Server actions of /admin/contacts. Each one re-checks the super-admin
 * (requireSuperAdmin), works with the service role client, and writes an
 * outreach_events row. No mail is sent here and no AI is called: the buttons
 * write the state (send_status = 'planifie'); actual sending is the cron.
 *
 * The database triggers stay the last line of defence (outreach_guard_outbound,
 * outreach_threads_stage): their error text is translated by friendlyError().
 */

const INITIAL_MAX = 2500;
const FOLLOW_UP_MAX = 1200;
const REPLY_MAX = 8000;
const LOT_MAX = 20;
/** Provisional spacing between the messages of a batch; step 3 (schedule.ts) replaces it with real slots. */
const LOT_SPACING_MIN = 10;

type Admin = SupabaseClient;
interface Ctx { email: string; admin: Admin }

async function context(): Promise<Ctx | null> {
  const { email } = await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return null;
  return { email, admin };
}

const NO_CONFIG: ActionResult<never> = { ok: false, error: "Configuration serveur manquante." };

function refresh() {
  // The admin layout carries the "à toi" badge: refresh it with the pages.
  revalidatePath("/admin", "layout");
}

/** Translates the trigger messages of 0021 into something readable. */
function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  const msg = err?.message ?? "Erreur inconnue.";
  const guard: [string, string][] = [
    ["program or mailbox inactive", "Le programme ou sa boîte n'est pas actif : rien ne peut être planifié pour l'instant."],
    ["invalid address", "Cette adresse est invalide ou en rebond."],
    ["recipient asked not to be contacted", "Cette personne a demandé qu'on ne lui écrive plus."],
    ["thread is closed", "Le fil est clos."],
    ["not approved by Leo", "Le message n'est pas approuvé."],
    ["automatic sending is off", "L'envoi automatique est coupé pour ce programme."],
    ["mailbox or program paused", "La boîte ou le programme est en pause."],
    ["follow-up no longer due", "La relance n'est plus due."],
    ["no recipient", "Aucune adresse destinataire pour ce fil."],
    ["program, settings, mailbox or stage missing", "Configuration du programme incomplète."],
  ];
  if (msg.includes("outreach guard:")) {
    for (const [needle, text] of guard) if (msg.includes(needle)) return text;
    return "Garde-fou de la base : " + msg.replace(/^.*outreach guard:\s*/, "");
  }
  if (msg.includes("transition") && msg.includes("not allowed")) return "Cette transition n'est pas autorisée par la base.";
  if (msg.includes("may not move a thread")) return "Tu n'es pas autorisé à faire cette transition.";
  if (msg.includes("is not ready:")) {
    const missing = msg.split("is not ready:")[1]?.trim() ?? "";
    return "Programme incomplet, activation refusée : " + missing + ".";
  }
  if (msg.includes("immutable")) return "Une version de contexte ne se modifie pas : crée une nouvelle version.";
  return msg;
}

async function logEvent(
  admin: Admin,
  e: { program_id?: string | null; thread_id?: string | null; contact_id?: string | null; message_id?: string | null; type: string; data?: Record<string, unknown> },
): Promise<void> {
  // Never an address nor a mail body in `data` (spec 3.5).
  const { error } = await admin.from("outreach_events").insert({
    program_id: e.program_id ?? null,
    thread_id: e.thread_id ?? null,
    contact_id: e.contact_id ?? null,
    message_id: e.message_id ?? null,
    actor: "leo",
    type: e.type,
    data: e.data ?? {},
  });
  if (error) console.error("[outreach] event not written:", e.type, error.code);
}

async function loadThread(admin: Admin, id: string): Promise<{ thread: Thread; program: ProgramConfig } | null> {
  const { data } = await admin.from("outreach_threads").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const thread = data as Thread;
  const program = await getProgramConfig(thread.program_id);
  return program ? { thread, program } : null;
}

// ---------------------------------------------------------------------------
// Validation of drafts
// ---------------------------------------------------------------------------

/** Validates one outbound draft: initial message -> planifie, thread a_valider -> planifie. */
async function validateOne(ctx: Ctx, threadId: string, scheduledFor: Date, lotId: string | null): Promise<ActionResult> {
  const { admin, email } = ctx;
  const loaded = await loadThread(admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { thread, program } = loaded;

  if (program.direction !== "sortant") return { ok: false, error: "Seuls les programmes sortants ont des brouillons à valider." };
  const draftStage = stageByRole(program, "a_valider");
  const plannedStage = stageByRole(program, "planifie");
  if (!draftStage || !plannedStage || thread.status !== draftStage.slug) return { ok: false, error: "Ce fil n'est plus à valider." };
  if (!canTransition(program, thread.status, plannedStage.slug, "leo")) return { ok: false, error: "Transition non autorisée." };

  const { data: msgs } = await admin.from("outreach_messages").select("*")
    .eq("thread_id", threadId).eq("direction", "out").eq("send_status", "a_valider");
  const initial = ((msgs ?? []) as Message[]).find((m) => m.kind === "initial");
  const followUp = ((msgs ?? []) as Message[]).find((m) => m.kind === "relance");
  if (!initial) return { ok: false, error: "Aucun premier mail à valider dans ce fil." };
  const text = initial.body_text ?? initial.draft_text ?? "";
  if (!text.trim() || /\{\{/.test(text)) return { ok: false, error: "Le texte est vide ou contient une variable non remplacée." };

  const now = new Date().toISOString();
  const { data: updated, error } = await admin.from("outreach_messages").update({
    send_status: "planifie", approved_by: email, approved_at: now, scheduled_for: scheduledFor.toISOString(),
  }).eq("id", initial.id).eq("send_status", "a_valider").select("id");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!updated || updated.length === 0) return { ok: false, error: "Le message a déjà changé d'état." };

  // The follow-up is approved with the first mail; the cron plans it after the first send (spec 5.1).
  if (followUp) {
    await admin.from("outreach_messages").update({ approved_by: email, approved_at: now }).eq("id", followUp.id);
  }

  const { error: tErr } = await admin.from("outreach_threads")
    .update({ status: plannedStage.slug, lot_id: lotId }).eq("id", threadId).eq("status", draftStage.slug);
  if (tErr) {
    // Put the message back: a queued message on a thread still "à valider" would be inconsistent.
    await admin.from("outreach_messages").update({ send_status: "a_valider", approved_by: null, approved_at: null, scheduled_for: null }).eq("id", initial.id);
    if (followUp) await admin.from("outreach_messages").update({ approved_by: null, approved_at: null }).eq("id", followUp.id);
    return { ok: false, error: friendlyError(tErr) };
  }

  await logEvent(admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, type: "thread.validated", data: { lot_id: lotId, template: thread.template_id, custom: thread.is_custom } });
  await logEvent(admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, message_id: initial.id, type: "message.queued", data: { kind: "initial", author: "leo", scheduled_for: scheduledFor.toISOString() } });
  return { ok: true };
}

/** Validates one draft (single validation). */
export async function validateDraft(threadId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const res = await validateOne(ctx, threadId, new Date(), null);
  if (res.ok) refresh();
  return res;
}

/**
 * Validates a batch: 20 threads at most, same program, same template, same
 * article, none of them custom. Sends are spread by LOT_SPACING_MIN minutes.
 */
export async function validateLot(threadIds: string[]): Promise<ActionResult<{ validated: number; failed: number }>> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const ids = [...new Set(threadIds)];
  if (ids.length === 0) return { ok: false, error: "Aucun fil sélectionné." };
  if (ids.length > LOT_MAX) return { ok: false, error: `Un lot compte ${LOT_MAX} fils au plus.` };

  const { data } = await ctx.admin.from("outreach_threads").select("*").in("id", ids);
  const threads = (data ?? []) as Thread[];
  if (threads.length !== ids.length) return { ok: false, error: "Certains fils du lot n'existent plus." };
  const first = threads[0];
  const uniform = threads.every((t) => t.program_id === first.program_id && t.template_id === first.template_id && t.article_id === first.article_id);
  if (!uniform) return { ok: false, error: "Un lot réunit un seul programme, un seul gabarit et un seul article." };
  if (threads.some((t) => t.is_custom)) return { ok: false, error: "Un brouillon personnalisé se valide seul." };

  const lotId = randomUUID();
  const start = Date.now();
  let validated = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const [i, id] of ids.entries()) {
    const res = await validateOne(ctx, id, new Date(start + i * LOT_SPACING_MIN * 60_000), lotId);
    if (res.ok) validated++;
    else { failed++; firstError ??= res.error; }
  }
  if (validated > 0) {
    await logEvent(ctx.admin, { program_id: first.program_id, type: "lot.validated", data: { lot_id: lotId, count: validated, template: first.template_id } });
    refresh();
  }
  if (validated === 0) return { ok: false, error: firstError ?? "Aucun fil validé." };
  return { ok: true, data: { validated, failed }, error: failed ? `${failed} fil(s) refusé(s) : ${firstError}` : undefined };
}

// ---------------------------------------------------------------------------
// Moving a thread between stages
// ---------------------------------------------------------------------------

/**
 * Moves a thread. `canTransition(program, from, to, "leo")` decides; the
 * database trigger checks again. The board and the thread page both call this.
 */
export async function setThreadStatus(threadId: string, toSlug: string, reason?: ClosedReason): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { admin } = ctx;
  const loaded = await loadThread(admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { thread, program } = loaded;

  const from = stageBySlug(program, thread.status);
  const to = stageBySlug(program, toSlug);
  if (!from || !to) return { ok: false, error: "Étape inconnue pour ce programme." };
  if (from.slug === to.slug) return { ok: true };
  if (reason !== undefined && !MANUAL_CLOSED_REASONS.includes(reason)) return { ok: false, error: "Motif de clôture non permis à la main." };
  if (to.role === "clos" && reason === undefined) return { ok: false, error: "Un fil se clôt avec un motif." };
  if (!canTransition(program, from.slug, to.slug, "leo", to.role === "clos" ? reason : undefined)) {
    return { ok: false, error: `Tu ne peux pas passer un fil de « ${from.label} » à « ${to.label} ».` };
  }

  // a_valider -> planifie is a validation (message queued).
  if (from.role === "a_valider" && to.role === "planifie") {
    const res = await validateOne(ctx, threadId, new Date(), null);
    if (res.ok) { await logMove(ctx, thread, program.id, from.slug, to.slug); refresh(); }
    return res;
  }

  // Refuse any move while a send is in flight.
  const { count: inFlight } = await admin.from("outreach_messages").select("id", { count: "exact", head: true })
    .eq("thread_id", threadId).eq("send_status", "en_cours");
  if ((inFlight ?? 0) > 0 && (to.role === "clos" || to.role === "a_valider")) {
    return { ok: false, error: "Un envoi est en cours pour ce fil, réessaie dans quelques minutes." };
  }

  const patch: Record<string, unknown> = { status: toSlug, closed_reason: to.role === "clos" ? reason : null };
  if (to.role === "clos" && reason === "ne_plus_ecrire") patch.opted_out_at = new Date().toISOString();
  // A closed thread no longer needs Leo.
  if (to.role === "clos") { patch.needs_leo = false; patch.needs_leo_reason = null; patch.needs_leo_since = null; }

  const { error } = await admin.from("outreach_threads").update(patch).eq("id", threadId).eq("status", from.slug);
  if (error) return { ok: false, error: friendlyError(error) };

  // planifie -> a_valider (withdraw before sending) and any closing: queued messages are cancelled or unscheduled.
  if (from.role === "planifie" && to.role === "a_valider") {
    await admin.from("outreach_messages").update({ send_status: "a_valider", approved_by: null, approved_at: null, scheduled_for: null })
      .eq("thread_id", threadId).eq("send_status", "planifie");
  }
  if (to.role === "clos") {
    const { data: cancelled } = await admin.from("outreach_messages").update({ send_status: "annule" })
      .eq("thread_id", threadId).eq("direction", "out").in("send_status", ["a_valider", "planifie"]).select("id, kind");
    for (const m of (cancelled ?? []) as { id: string; kind: string }[]) {
      await logEvent(admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, message_id: m.id, type: "message.cancelled", data: { kind: m.kind, why: "fil_clos" } });
    }
    if (reason === "ne_plus_ecrire") await recordOptOut(ctx, thread, program.id);
  }

  await logMove(ctx, thread, program.id, from.slug, to.slug, reason);
  refresh();
  return { ok: true };
}

async function logMove(ctx: Ctx, thread: Thread, programId: string, from: string, to: string, reason?: ClosedReason) {
  await logEvent(ctx.admin, {
    program_id: programId, thread_id: thread.id, contact_id: thread.contact_id,
    type: "thread.moved", data: { from, to, closed_reason: reason ?? null },
  });
}

/** Leo records an opt-out: the whole contact stops receiving unsolicited or automatic mail. */
async function recordOptOut(ctx: Ctx, thread: Thread, programId: string) {
  const { admin } = ctx;
  const now = new Date().toISOString();
  await admin.from("outreach_contacts").update({ do_not_contact: true, do_not_contact_at: now, do_not_contact_source: "leo" }).eq("id", thread.contact_id);
  const { data: addrs } = await admin.from("outreach_addresses").select("id, email").eq("contact_id", thread.contact_id);
  for (const a of (addrs ?? []) as { id: string; email: string }[]) {
    await admin.from("outreach_suppressions").upsert({ email: a.email, reason: "leo", source: "admin", thread_id: thread.id }, { onConflict: "email", ignoreDuplicates: true });
    await admin.from("outreach_addresses").update({ status: "opt_out", status_at: now }).eq("id", a.id).eq("status", "valide");
  }
  await logEvent(admin, { program_id: programId, thread_id: thread.id, contact_id: thread.contact_id, type: "reply.opt_out", data: { detected_by: "leo" } });
}

/** Discards a draft (a_valider -> clos, abandonne or doublon). */
export async function discardDraft(threadId: string, reason: "abandonne" | "doublon" = "abandonne"): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const loaded = await loadThread(ctx.admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const closed = loaded.program.stages.find((s) => s.role === "clos");
  if (!closed) return { ok: false, error: "Ce programme n'a pas d'étape de clôture." };
  return setThreadStatus(threadId, closed.slug, reason);
}

// ---------------------------------------------------------------------------
// Editing drafts
// ---------------------------------------------------------------------------

/** Rewrites the text of an unsent draft (first mail or follow-up). */
export async function updateDraftText(messageId: string, text: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const body = text.replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, error: "Le texte est vide." };
  if (/\{\{/.test(body)) return { ok: false, error: "Le texte contient une variable non remplacée ({{…}})." };

  const { data } = await ctx.admin.from("outreach_messages").select("*").eq("id", messageId).maybeSingle();
  const msg = data as Message | null;
  if (!msg || msg.direction !== "out") return { ok: false, error: "Message introuvable." };
  if (msg.send_status !== "a_valider") return { ok: false, error: "Ce message n'est plus un brouillon : retire-le de la file avant de le modifier." };
  const max = msg.kind === "relance" ? FOLLOW_UP_MAX : INITIAL_MAX;
  if (body.length > max) return { ok: false, error: `Ce texte dépasse ${max} caractères.` };

  const { error } = await ctx.admin.from("outreach_messages").update({ body_text: body, draft_text: body, modified_by_leo: true }).eq("id", messageId);
  if (error) return { ok: false, error: friendlyError(error) };
  const t = await loadThread(ctx.admin, msg.thread_id);
  await logEvent(ctx.admin, { program_id: t?.program.id, thread_id: msg.thread_id, contact_id: t?.thread.contact_id, message_id: messageId, type: "draft.edited", data: { kind: msg.kind, field: "texte" } });
  refresh();
  return { ok: true };
}

/**
 * Replaces the personal sentence of a draft. The text of the draft was rendered
 * from the template, so the previous sentence is found and replaced in it.
 */
export async function updatePersonalLine(threadId: string, line: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const next = line.replace(/\s+/g, " ").trim();
  if (!next) return { ok: false, error: "La phrase personnalisée ne peut pas être vide." };
  if (/\{\{|\}\}/.test(next)) return { ok: false, error: "La phrase ne peut pas contenir de variable {{…}}." };

  const loaded = await loadThread(ctx.admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { thread, program } = loaded;
  const draftStage = stageByRole(program, "a_valider");
  if (!draftStage || thread.status !== draftStage.slug) return { ok: false, error: "Ce fil n'est plus à valider." };
  if (thread.is_custom) return { ok: false, error: "Un brouillon personnalisé se modifie en entier, pas par sa phrase." };
  const old = thread.personal_line;
  if (!old) return { ok: false, error: "Ce fil n'a pas de phrase personnalisée enregistrée." };
  if (old === next) return { ok: true };

  const { data } = await ctx.admin.from("outreach_messages").select("*")
    .eq("thread_id", threadId).eq("direction", "out").eq("send_status", "a_valider");
  const msgs = (data ?? []) as Message[];
  const initial = msgs.find((m) => m.kind === "initial");
  if (!initial) return { ok: false, error: "Aucun premier mail à modifier." };
  const current = initial.body_text ?? initial.draft_text ?? "";
  if (!current.includes(old)) return { ok: false, error: "La phrase n'apparaît plus telle quelle dans le texte : modifie le brouillon en entier." };
  const rewritten = current.split(old).join(next);
  if (rewritten.length > INITIAL_MAX) return { ok: false, error: `Le texte dépasserait ${INITIAL_MAX} caractères.` };

  const { error } = await ctx.admin.from("outreach_messages").update({ body_text: rewritten, draft_text: rewritten, modified_by_leo: true }).eq("id", initial.id);
  if (error) return { ok: false, error: friendlyError(error) };
  for (const m of msgs.filter((x) => x.kind === "relance")) {
    const b = m.body_text ?? "";
    if (b.includes(old)) await ctx.admin.from("outreach_messages").update({ body_text: b.split(old).join(next), draft_text: b.split(old).join(next) }).eq("id", m.id);
  }
  await ctx.admin.from("outreach_threads").update({ personal_line: next }).eq("id", threadId);
  await logEvent(ctx.admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, message_id: initial.id, type: "draft.edited", data: { kind: "initial", field: "phrase_personnalisee" } });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// "À toi" and replies
// ---------------------------------------------------------------------------

/** Marks a thread "à toi" as handled (lifts the flag). */
export async function markHandled(threadId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const loaded = await loadThread(ctx.admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { thread, program } = loaded;
  if (!thread.needs_leo) return { ok: true };
  const { error } = await ctx.admin.from("outreach_threads")
    .update({ needs_leo: false, needs_leo_reason: null, needs_leo_since: null }).eq("id", threadId);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, type: "thread.handled", data: { reason: thread.needs_leo_reason } });
  refresh();
  return { ok: true };
}

/** Word-level edit ratio between two texts, 0 (identical) to 1. */
function editRatio(a: string, b: string): number {
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  if (x.length === 0 && y.length === 0) return 0;
  if (x.length > 1500 || y.length > 1500) return 1;
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  const lcs = prev[y.length];
  return Math.round((1 - (2 * lcs) / (x.length + y.length)) * 1000) / 1000;
}

/**
 * Leo answers a message: a 'reponse' written by Leo, approved on the spot,
 * queued (send_status 'planifie') for the next cron run. Nothing is sent here.
 */
export async function sendReply(threadId: string, text: string, addToKnowledge = false): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { admin, email } = ctx;
  const body = text.replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, error: "Écris ta réponse avant de l'envoyer." };
  if (body.length > REPLY_MAX) return { ok: false, error: `La réponse dépasse ${REPLY_MAX} caractères.` };

  const loaded = await loadThread(admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { thread, program } = loaded;

  const [{ data: inboundRows }, addrR] = await Promise.all([
    admin.from("outreach_messages").select("*").eq("thread_id", threadId).eq("direction", "in").order("created_at", { ascending: false }).limit(10),
    thread.address_id ? admin.from("outreach_addresses").select("email").eq("id", thread.address_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const inbound = (inboundRows ?? []) as Message[];
  const lastHuman = inbound.find((m) => m.kind === "entrant" || m.kind === "formulaire") ?? inbound[0] ?? null;
  const to = ((addrR.data as { email: string } | null)?.email) ?? lastHuman?.from_email ?? null;
  if (!to) return { ok: false, error: "Aucune adresse destinataire pour ce fil." };

  const baseSubject = (lastHuman?.subject ?? thread.email_subject).replace(/^(re|réf|ref)\s*:\s*/i, "").trim();
  const aiDraft = lastHuman?.ai_draft ?? null;
  const ratio = aiDraft ? editRatio(aiDraft, body) : null;
  const scheduled = new Date();

  const { data: inserted, error } = await admin.from("outreach_messages").insert({
    thread_id: threadId,
    direction: "out",
    kind: "reponse",
    to_email: to,
    subject: `Re: ${baseSubject}`.slice(0, 200),
    body_text: body,
    draft_text: aiDraft ?? body,
    draft_source: aiDraft ? "ia" : "leo",
    modified_by_leo: ratio === null ? null : ratio > 0.02,
    edit_ratio: ratio,
    add_to_knowledge: addToKnowledge,
    reply_to_message_id: lastHuman?.id ?? null,
    send_status: "planifie",
    author: "leo",
    approved_by: email,
    approved_at: scheduled.toISOString(),
    scheduled_for: scheduled.toISOString(),
    match_method: "leo",
  }).select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  await admin.from("outreach_threads")
    .update({ needs_leo: false, needs_leo_reason: null, needs_leo_since: null, auto_streak: 0 }).eq("id", threadId);
  await logEvent(admin, { program_id: program.id, thread_id: threadId, contact_id: thread.contact_id, message_id: inserted?.id as string, type: "message.queued", data: { kind: "reponse", author: "leo", scheduled_for: scheduled.toISOString() } });
  refresh();
  return { ok: true };
}

/** Cancels a queued message (an automatic reply, or a reply Leo changed his mind about). */
export async function cancelQueuedMessage(messageId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { data } = await ctx.admin.from("outreach_messages").update({ send_status: "annule" })
    .eq("id", messageId).eq("send_status", "planifie").select("id, kind, thread_id");
  const row = (data ?? [])[0] as { id: string; kind: string; thread_id: string } | undefined;
  if (!row) return { ok: false, error: "Ce message n'est plus dans la file." };
  const t = await loadThread(ctx.admin, row.thread_id);
  await logEvent(ctx.admin, { program_id: t?.program.id, thread_id: row.thread_id, contact_id: t?.thread.contact_id, message_id: row.id, type: "message.cancelled", data: { kind: row.kind, why: "annule_par_leo" } });
  refresh();
  return { ok: true };
}

/** Changes the subject the thread is filed under (panel "lecture par l'IA"). */
export async function setThreadSubject(threadId: string, subjectId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const loaded = await loadThread(ctx.admin, threadId);
  if (!loaded) return { ok: false, error: "Fil introuvable." };
  const { data: subject } = await ctx.admin.from("outreach_subjects").select("id, slug, program_id").eq("id", subjectId).maybeSingle();
  if (!subject || (subject as Subject).program_id !== loaded.program.id) return { ok: false, error: "Sujet inconnu pour ce programme." };
  const { error } = await ctx.admin.from("outreach_threads").update({ current_subject_id: subjectId }).eq("id", threadId);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: loaded.program.id, thread_id: threadId, contact_id: loaded.thread.contact_id, type: "thread.subject_changed", data: { slug: (subject as Subject).slug } });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pauses and activation
// ---------------------------------------------------------------------------

export async function setProgramPause(slug: string, paused: boolean, reason?: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const why = (reason ?? "").trim();
  if (paused && !why) return { ok: false, error: "Indique la raison de la pause." };
  const { error } = await ctx.admin.from("outreach_settings").update(
    paused
      ? { paused: true, pause_reason: why.slice(0, 300), paused_at: new Date().toISOString(), updated_by: ctx.email }
      : { paused: false, pause_reason: null, paused_at: null, updated_by: ctx.email },
  ).eq("program_id", program.id);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: paused ? "pause.manual" : "pause.lifted", data: { scope: "programme", reason: paused ? why.slice(0, 300) : null } });
  refresh();
  return { ok: true };
}

export async function setMailboxPause(key: string, paused: boolean, reason?: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const why = (reason ?? "").trim();
  if (paused && !why) return { ok: false, error: "Indique la raison de la pause." };
  const { data, error } = await ctx.admin.from("outreach_mailboxes").update(
    paused
      ? { paused: true, pause_reason: why.slice(0, 300), paused_at: new Date().toISOString() }
      : { paused: false, pause_reason: null, paused_at: null },
  ).eq("key", key).select("key");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Boîte inconnue." };
  await logEvent(ctx.admin, { type: paused ? "pause.manual" : "pause.lifted", data: { scope: "boite", mailbox: key, reason: paused ? why.slice(0, 300) : null } });
  refresh();
  return { ok: true };
}

/** Activates or deactivates a program. The database refuses an incomplete program. */
export async function setProgramActive(slug: string, active: boolean): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const { error } = await ctx.admin.from("outreach_programs").update({ active }).eq("id", program.id);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: active ? "program.activated" : "program.deactivated", data: { active } });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Program context (versioned, immutable)
// ---------------------------------------------------------------------------

/** Saves a NEW inactive, unreviewed version. A version is never modified. */
export async function createContextVersion(slug: string, body: string, note?: string): Promise<ActionResult<{ version: number }>> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const text = body.replace(/\r\n/g, "\n").trim();
  if (text.length < 200) return { ok: false, error: "Le contexte doit compter au moins 200 caractères." };
  if (text.length > 20000) return { ok: false, error: "Le contexte dépasse 20 000 caractères." };

  const { data: last } = await ctx.admin.from("outreach_program_contexts").select("version")
    .eq("program_id", program.id).order("version", { ascending: false }).limit(1);
  const version = ((last?.[0] as { version: number } | undefined)?.version ?? 0) + 1;
  const { error } = await ctx.admin.from("outreach_program_contexts").insert({
    program_id: program.id, version, body: text, active: false, written_by: "leo", change_note: note?.trim().slice(0, 300) || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: "context.created", data: { version } });
  refresh();
  return { ok: true, data: { version } };
}

/** Marks a version as read by Leo (required before it can be activated). */
export async function markContextReviewed(contextId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { data, error } = await ctx.admin.from("outreach_program_contexts")
    .update({ reviewed_by: ctx.email, reviewed_at: new Date().toISOString() })
    .eq("id", contextId).is("reviewed_at", null).select("program_id, version");
  if (error) return { ok: false, error: friendlyError(error) };
  const row = (data ?? [])[0] as { program_id: string; version: number } | undefined;
  if (!row) return { ok: false, error: "Cette version est déjà relue, ou n'existe pas." };
  await logEvent(ctx.admin, { program_id: row.program_id, type: "context.reviewed", data: { version: row.version } });
  refresh();
  return { ok: true };
}

/** Makes a reviewed version the active one (the previous one stays readable, frozen). */
export async function activateContext(contextId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { admin } = ctx;
  const { data: target } = await admin.from("outreach_program_contexts").select("*").eq("id", contextId).maybeSingle();
  const row = target as { id: string; program_id: string; version: number; active: boolean; reviewed_at: string | null } | null;
  if (!row) return { ok: false, error: "Version introuvable." };
  if (!row.reviewed_at) return { ok: false, error: "Marque d'abord cette version comme relue." };
  if (row.active) return { ok: true };

  const { data: current } = await admin.from("outreach_program_contexts").select("id").eq("program_id", row.program_id).eq("active", true);
  const previous = ((current ?? []) as { id: string }[]).map((c) => c.id);
  if (previous.length) {
    const { error } = await admin.from("outreach_program_contexts").update({ active: false }).in("id", previous);
    if (error) return { ok: false, error: friendlyError(error) };
  }
  const { error } = await admin.from("outreach_program_contexts").update({ active: true }).eq("id", contextId);
  if (error) {
    // Restore the previous active version: a program must not be left without one.
    if (previous.length) await admin.from("outreach_program_contexts").update({ active: true }).in("id", previous);
    return { ok: false, error: friendlyError(error) };
  }
  await logEvent(admin, { program_id: row.program_id, type: "context.activated", data: { version: row.version } });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Program identity, settings, stages, red zones, subjects
// ---------------------------------------------------------------------------

export interface IdentityInput { label: string; description: string; sender_name: string; address_form: "tu" | "vous"; signature: string }

export async function updateProgramIdentity(slug: string, input: IdentityInput): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const label = oneLine(input.label);
  const senderName = oneLine(input.sender_name);
  if (!label) return { ok: false, error: "Le libellé est obligatoire." };
  if (senderName.length < 2 || senderName.length > 80) return { ok: false, error: "Le nom d'envoi compte de 2 à 80 caractères." };
  if (!input.description.trim()) return { ok: false, error: "La description est obligatoire." };
  if (input.signature.trim().length < 2 || input.signature.length > 500) return { ok: false, error: "La signature compte de 2 à 500 caractères." };
  if (input.address_form !== "tu" && input.address_form !== "vous") return { ok: false, error: "Forme d'adresse inconnue." };

  const { error } = await ctx.admin.from("outreach_programs").update({
    label, description: input.description.trim(), sender_name: senderName, address_form: input.address_form, signature: input.signature.trim(),
  }).eq("id", program.id);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: "settings.changed", data: { area: "identite", fields: ["label", "description", "sender_name", "address_form", "signature"] } });
  refresh();
  return { ok: true };
}

/** Settings Leo may edit. auto_send_enabled is NOT here: automatic replies stay off until step 7. */
const SETTING_BOUNDS: Record<string, [number, number]> = {
  confidence_threshold: [0.5, 0.99],
  auto_streak_limit: [0, 10],
  auto_reply_delay_min: [0, 1440],
  auto_min_reviewed: [5, 200],
  edited_threshold: [0, 1],
  daily_cap: [0, 500],
  per_run_cap: [1, 20],
  follow_up_after_days: [3, 30],
  max_follow_ups: [0, 1],
  close_after_days: [7, 120],
  min_days_between_threads: [0, 365],
  sla_first_response_hours: [1, 720],
  resolved_autoclose_days: [1, 60],
  link_ttl_days: [7, 365],
  retention_months: [1, 120],
};

export async function updateProgramSettings(slug: string, patch: Record<string, number | string | null>): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };

  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "send_start" || key === "send_end") {
      if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { ok: false, error: "Heure invalide (format HH:MM)." };
      row[key] = value;
      continue;
    }
    if (key === "ramp_started_on") {
      if (value !== null && value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return { ok: false, error: "Date de début de rampe invalide." };
      row[key] = value ? String(value) : null;
      continue;
    }
    const bounds = SETTING_BOUNDS[key];
    if (!bounds) return { ok: false, error: `Réglage non modifiable ici : ${key}.` };
    const n = Number(value);
    if (!Number.isFinite(n) || n < bounds[0] || n > bounds[1]) return { ok: false, error: `${key} doit être compris entre ${bounds[0]} et ${bounds[1]}.` };
    row[key] = key === "confidence_threshold" || key === "edited_threshold" ? n : Math.round(n);
  }
  const start = (row.send_start ?? program.settings?.send_start ?? "09:00").toString().slice(0, 5);
  const end = (row.send_end ?? program.settings?.send_end ?? "17:30").toString().slice(0, 5);
  if (start >= end) return { ok: false, error: "L'heure de début doit précéder l'heure de fin." };
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await ctx.admin.from("outreach_settings").update({ ...row, updated_by: ctx.email }).eq("program_id", program.id);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: "settings.changed", data: { area: "reglages", fields: Object.keys(row) } });
  refresh();
  return { ok: true };
}

export async function updateStage(slug: string, stageSlug: string, input: { label: string; position: number; on_board: boolean }): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const label = input.label.replace(/[\r\n]+/g, " ").trim();
  if (!label || label.length > 60) return { ok: false, error: "Le libellé compte de 1 à 60 caractères." };
  if (!Number.isInteger(input.position) || input.position < 0 || input.position > 999) return { ok: false, error: "Position invalide." };
  const { data, error } = await ctx.admin.from("outreach_program_stages")
    .update({ label, position: input.position, on_board: !!input.on_board }).eq("program_id", program.id).eq("slug", stageSlug).select("slug");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Étape inconnue." };
  await logEvent(ctx.admin, { program_id: program.id, type: "settings.changed", data: { area: "etapes", fields: [stageSlug] } });
  refresh();
  return { ok: true };
}

export async function addProgramRedZone(slug: string, input: { code: string; label: string; description: string }): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const program = await getProgramConfig(slug);
  if (!program) return { ok: false, error: "Programme inconnu." };
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z_]{3,40}$/.test(code)) return { ok: false, error: "Le code compte 3 à 40 lettres minuscules ou _." };
  if (!input.label.trim() || !input.description.trim()) return { ok: false, error: "Le libellé et la description sont obligatoires." };
  const { data: universal } = await ctx.admin.from("outreach_red_zones").select("id").is("program_id", null).eq("code", code);
  if ((universal ?? []).length > 0) return { ok: false, error: "Ce code existe déjà comme zone rouge universelle : il ne se redéfinit pas." };
  const { data: last } = await ctx.admin.from("outreach_red_zones").select("position").eq("program_id", program.id).order("position", { ascending: false }).limit(1);
  const position = ((last?.[0] as { position: number } | undefined)?.position ?? 100) + 10;
  const { error } = await ctx.admin.from("outreach_red_zones").insert({
    program_id: program.id, code, label: input.label.trim().slice(0, 80), description: input.description.trim().slice(0, 400), position,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "Ce code existe déjà dans ce programme." : friendlyError(error) };
  await logEvent(ctx.admin, { program_id: program.id, type: "settings.changed", data: { area: "zones_rouges", fields: ["ajout:" + code] } });
  refresh();
  return { ok: true };
}

export async function removeProgramRedZone(zoneId: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { data: zone } = await ctx.admin.from("outreach_red_zones").select("id, program_id, code").eq("id", zoneId).maybeSingle();
  const z = zone as { id: string; program_id: string | null; code: string } | null;
  if (!z) return { ok: false, error: "Zone rouge introuvable." };
  if (z.program_id === null) return { ok: false, error: "Une zone rouge universelle ne se retire pas." };
  const { error } = await ctx.admin.from("outreach_red_zones").delete().eq("id", zoneId);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(ctx.admin, { program_id: z.program_id, type: "settings.changed", data: { area: "zones_rouges", fields: ["retrait:" + z.code] } });
  refresh();
  return { ok: true };
}

/**
 * Turns automatic replies on or off for one subject. Turning ON is refused
 * under the barrier (enough replies reviewed, few of them edited) and for a
 * red-zone subject; turning OFF is always allowed.
 */
export async function setSubjectAuto(subjectId: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return NO_CONFIG;
  const { admin } = ctx;
  const { data } = await admin.from("outreach_subjects").select("*").eq("id", subjectId).maybeSingle();
  const subject = data as Subject | null;
  if (!subject) return { ok: false, error: "Sujet introuvable." };
  if (enabled) {
    if (subject.zone_rouge) return { ok: false, error: "Un sujet en zone rouge ne passe jamais en automatique." };
    const [{ data: q }, { data: s }] = await Promise.all([
      admin.from("outreach_v_subject_quality").select("*").eq("subject_id", subjectId).maybeSingle(),
      admin.from("outreach_settings").select("auto_min_reviewed, edited_threshold").eq("program_id", subject.program_id).maybeSingle(),
    ]);
    const quality = q as SubjectQualityRow | null;
    const set = s as { auto_min_reviewed: number; edited_threshold: number } | null;
    if (!quality || !set) return { ok: false, error: "Les chiffres de qualité ne sont pas disponibles." };
    if (quality.relues_par_leo < set.auto_min_reviewed) {
      return { ok: false, error: `Il manque des réponses relues : ${quality.relues_par_leo} sur ${set.auto_min_reviewed}.` };
    }
    if (quality.part_modifiee_20_dernieres === null || quality.part_modifiee_20_dernieres >= set.edited_threshold) {
      return { ok: false, error: "Trop de brouillons de l'IA sont modifiés avant l'envoi pour ce sujet." };
    }
  }
  const { error } = await admin.from("outreach_subjects").update(
    enabled ? { auto_enabled: true, auto_enabled_at: new Date().toISOString(), auto_enabled_by: ctx.email } : { auto_enabled: false, auto_enabled_at: null, auto_enabled_by: null },
  ).eq("id", subjectId);
  if (error) return { ok: false, error: friendlyError(error) };
  await logEvent(admin, { program_id: subject.program_id, type: enabled ? "subject.auto_on" : "subject.auto_off", data: { slug: subject.slug } });
  refresh();
  return { ok: true };
}
