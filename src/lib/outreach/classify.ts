import "server-only";
/**
 * Classification of incoming messages (step 7): reads the thread, calls the AI,
 * applies decide(), writes the reading and raises "à toi" when a human is needed.
 * Also the triage hook of the shared mailboxes (registered by the inbox cron).
 *
 * AUTOMATIC SENDING IS OFF: this file never creates an outbound message. Even
 * if decide() were to answer "auto" (it cannot while auto_send_enabled is false),
 * the automatic queue is not wired in this step and the thread goes to Leo with
 * the reason `auto_coupe`.
 *
 * Nothing here logs an address, a mail body or a model answer; events carry
 * counts, codes and ids only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/guard";
import { getProgramConfigs } from "./programs";
import { stageBySlug } from "./status";
import { aiConfigured, aiModel, estimateCostUsd, readInbound, readTriage, type AiUsage } from "./ai";
import { decide, decideTheoretical, type Decision, type DecisionContext } from "./decide";
import { knowledgeByIds, loadKnowledgeForPrompt } from "./knowledge";
import { optOutContact } from "./optout";
import { extractReply, hasOptOutKeyword } from "./reply-extract";
import type { TriageFn } from "./inbox";
import { OUTREACH_PROMPT_VERSION, type AiInput, type PromptProgram } from "./prompt";
import { UNIVERSAL_RED_ZONE_CODES, type AiReading } from "./schema";
import type {
  Address, Contact, Mailbox, Message, NeedsLeoReason, ProgramConfig, ProgramContext, RedZone, Subject,
  SubjectQualityRow, Thread,
} from "./types";

type Admin = SupabaseClient;

export const MAX_AI_ATTEMPTS = 3;
/** Reasons another mechanism raised on the thread: the AI does not overwrite them. */
const KEEP_REASONS = new Set<string>(["lien_correction", "photos_recues", "justificatif_recu", "sla_depasse", "envoi_bloque"]);

export interface ClassifyOutcome {
  status: "classified" | "deferred" | "skipped" | "failed";
  decision?: Decision["kind"];
  reason?: string;
  costUsd?: number;
  usage?: AiUsage;
}

// ---- Small helpers -----------------------------------------------------------

async function event(
  admin: Admin, type: string, data: Record<string, unknown>,
  refs: { program_id?: string | null; thread_id?: string | null; contact_id?: string | null; message_id?: string | null },
): Promise<void> {
  const { error } = await admin.from("outreach_events").insert({
    program_id: refs.program_id ?? null, thread_id: refs.thread_id ?? null,
    contact_id: refs.contact_id ?? null, message_id: refs.message_id ?? null,
    actor: "ia", type, data,
  });
  if (error) console.error("[outreach-ai] event not written:", type, error.code);
}

function dayOf(m: Pick<Message, "sent_at" | "received_at" | "created_at">): string {
  const iso = m.sent_at ?? m.received_at ?? m.created_at;
  return (iso ?? "").slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- Everything one reading needs ----------------------------------------------

interface Loaded {
  message: Message;
  thread: Thread;
  program: ProgramConfig;
  mailbox: Mailbox | null;
  contact: Contact | null;
  address: Address | null;
  context: ProgramContext | null;
  subjects: Subject[];
  zones: RedZone[];
  quality: SubjectQualityRow[];
}

async function load(admin: Admin, messageId: string): Promise<Loaded | null> {
  const { data: m } = await admin.from("outreach_messages").select("*").eq("id", messageId).maybeSingle();
  const message = m as Message | null;
  if (!message || message.direction !== "in") return null;
  const { data: t } = await admin.from("outreach_threads").select("*").eq("id", message.thread_id).maybeSingle();
  const thread = t as Thread | null;
  if (!thread) return null;
  const program = (await getProgramConfigs()).find((p) => p.id === thread.program_id);
  if (!program) return null;

  const [mb, contact, addr, ctx, subjects, zones, quality] = await Promise.all([
    admin.from("outreach_mailboxes").select("*").eq("key", program.mailbox_key).maybeSingle(),
    admin.from("outreach_contacts").select("*").eq("id", thread.contact_id).maybeSingle(),
    thread.address_id
      ? admin.from("outreach_addresses").select("*").eq("id", thread.address_id).maybeSingle()
      : message.from_email
        ? admin.from("outreach_addresses").select("*").eq("contact_id", thread.contact_id).eq("email", message.from_email).maybeSingle()
        : Promise.resolve({ data: null }),
    admin.from("outreach_program_contexts").select("*").eq("program_id", program.id).eq("active", true).maybeSingle(),
    admin.from("outreach_subjects").select("*").eq("program_id", program.id).order("position"),
    admin.from("outreach_red_zones").select("*").or(`program_id.is.null,program_id.eq.${program.id}`).order("position"),
    admin.from("outreach_v_subject_quality").select("*").eq("program_id", program.id),
  ]);
  return {
    message, thread, program,
    mailbox: (mb.data as Mailbox | null) ?? null,
    contact: (contact.data as Contact | null) ?? null,
    address: (addr.data as Address | null) ?? null,
    context: (ctx.data as ProgramContext | null) ?? null,
    subjects: (subjects.data ?? []) as Subject[],
    zones: (zones.data ?? []) as RedZone[],
    quality: (quality.data ?? []) as SubjectQualityRow[],
  };
}

/** The thread as the model sees it: earlier messages that were really written or sent. */
async function threadHistory(admin: Admin, threadId: string, exceptId: string): Promise<AiInput["thread"]> {
  const { data } = await admin
    .from("outreach_messages")
    .select("id, direction, kind, send_status, body_text, body_reply, sent_at, received_at, created_at")
    .eq("thread_id", threadId)
    .in("kind", ["initial", "relance", "reponse", "hors_admin", "entrant", "formulaire"])
    .order("created_at", { ascending: true })
    .limit(40);
  return ((data ?? []) as Message[])
    .filter((m) => m.id !== exceptId && (m.direction === "in" || m.send_status === "envoye"))
    .map((m) => ({
      direction: m.direction === "out" ? ("envoye" as const) : ("recu" as const),
      date: dayOf(m),
      text: (m.direction === "in" ? m.body_reply || m.body_text : m.body_text) ?? "",
    }));
}

function promptProgramOf(l: Loaded): PromptProgram {
  const own = l.zones.filter((z) => z.program_id === l.program.id);
  return {
    slug: l.program.slug,
    direction: l.program.direction,
    sender_name: l.program.sender_name,
    address_form: l.program.address_form,
    contextVersion: l.context?.version ?? 0,
    contextBody: l.context?.body ?? "",
    subjects: l.subjects.map((s) => ({ slug: s.slug, label: s.label, description: s.description, zone_rouge: s.zone_rouge })),
    redZones: own.map((z) => ({ code: z.code, description: z.description })),
  };
}

// ---- Persisting a reading ----------------------------------------------------

async function applyThreadFlag(
  admin: Admin, l: Loaded, reason: NeedsLeoReason, subjectId: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (subjectId && l.thread.current_subject_id !== subjectId) patch.current_subject_id = subjectId;
  const keep = l.thread.needs_leo && !!l.thread.needs_leo_reason && KEEP_REASONS.has(l.thread.needs_leo_reason);
  if (!keep) {
    patch.needs_leo = true;
    patch.needs_leo_reason = reason;
    if (!l.thread.needs_leo) patch.needs_leo_since = new Date().toISOString();
  }
  if (Object.keys(patch).length > 0) await admin.from("outreach_threads").update(patch).eq("id", l.thread.id);
}

/** Opt-out through the same logic as the link and List-Unsubscribe (optout.ts). */
async function applyOpposition(admin: Admin, l: Loaded, detectedBy: "mots_cles" | "ia"): Promise<void> {
  await optOutContact(admin, { contactId: l.thread.contact_id, threadId: l.thread.id, source: "reponse" });
  await event(admin, "reply.opt_out", { detected_by: detectedBy }, {
    program_id: l.program.id, thread_id: l.thread.id, contact_id: l.thread.contact_id, message_id: l.message.id,
  });
  // A closed thread needs nobody; an open one (inbound program) is Leo's to answer.
  const { data: fresh } = await admin.from("outreach_threads").select("status, needs_leo, needs_leo_reason").eq("id", l.thread.id).maybeSingle();
  const st = fresh as { status: string; needs_leo: boolean; needs_leo_reason: string | null } | null;
  const closed = st ? stageBySlug(l.program, st.status)?.role === "clos" : false;
  if (closed) {
    await admin.from("outreach_threads").update({ needs_leo: false, needs_leo_reason: null, needs_leo_since: null }).eq("id", l.thread.id);
  } else {
    await applyThreadFlag(admin, l, "refus", null);
  }
}

interface Finish {
  reading: AiReading | null;
  usage: AiUsage | null;
  real: Decision;
  theoretical: Decision;
  subjectId: string | null;
  sources: string[];
  error: string | null;
  attempts: number;
}

async function persist(admin: Admin, l: Loaded, f: Finish): Promise<void> {
  const r = f.reading;
  const shown: "auto" | "a_toi" | "ignore" = f.real.kind === "ignore" ? "ignore" : f.theoretical.kind === "auto" ? "auto" : "a_toi";
  const reasons = f.real.reasons.slice(0, 20);
  const usage = f.usage;
  const { error } = await admin.from("outreach_messages").update({
    ai_subject_id: f.subjectId,
    ai_intent: r?.intention ?? null,
    ai_confidence: r ? round2(r.confiance) : null,
    ai_zone_rouge: r ? r.zone_rouge || r.zones_rouges.length > 0 : null,
    ai_red_zones: r?.zones_rouges.slice(0, 20) ?? [],
    ai_sources: f.sources,
    ai_opt_out: r ? r.opposition : f.real.kind === "ignore" && f.real.reason === "opposition" ? true : null,
    ai_summary: r?.resume ?? null,
    ai_draft: f.real.kind === "ignore" ? null : r?.brouillon ?? null,
    ai_decision: shown,
    ai_decision_reasons: reasons,
    ai_context_version: usage?.contextVersion ?? l.context?.version ?? null,
    ai_prompt_version: OUTREACH_PROMPT_VERSION,
    ai_triage_program_id: l.thread.triage_confidence !== null ? l.thread.program_id : null,
    ai_triage_confidence: l.thread.triage_confidence !== null ? round2(l.thread.triage_confidence) : null,
    ai_model: usage?.model ?? null,
    ai_input_tokens: usage ? usage.input + usage.cacheRead + usage.cacheWrite : null,
    ai_output_tokens: usage?.output ?? null,
    ai_attempts: f.attempts,
    ai_error: f.error,
    classified_at: new Date().toISOString(),
  }).eq("id", l.message.id);
  if (error) throw new Error(`persist failed: ${error.code ?? ""}`);

  await event(admin, "ai.classified", {
    decision: shown,
    real: f.real.kind,
    reasons,
    subject: l.subjects.find((s) => s.id === f.subjectId)?.slug ?? null,
    intent: r?.intention ?? null,
    confidence: r ? round2(r.confiance) : null,
    context_version: usage?.contextVersion ?? l.context?.version ?? null,
    model: usage?.model ?? null,
    tokens_in: usage?.input ?? 0,
    tokens_out: usage?.output ?? 0,
    cache_read: usage?.cacheRead ?? 0,
    cache_write: usage?.cacheWrite ?? 0,
    cost_usd: usage ? Math.round(estimateCostUsd(usage) * 10000) / 10000 : 0,
    error: f.error,
  }, { program_id: l.program.id, thread_id: l.thread.id, contact_id: l.thread.contact_id, message_id: l.message.id });

  if (f.real.kind === "a_toi") await applyThreadFlag(admin, l, f.real.reason, f.subjectId);
  else if (f.real.kind === "auto") await applyThreadFlag(admin, l, "auto_coupe", f.subjectId); // unreachable: see header
  else if (f.real.reason === "opposition") await applyOpposition(admin, l, r?.opposition ? "ia" : "mots_cles");
  else if (l.thread.needs_leo && l.thread.needs_leo_reason === "ia_indisponible") {
    await admin.from("outreach_threads").update({ needs_leo: false, needs_leo_reason: null, needs_leo_since: null }).eq("id", l.thread.id);
  }
}

/** Ends the reading without a model answer (no context, no key, unusable output). */
async function finishWithoutReading(
  admin: Admin, l: Loaded, reason: NeedsLeoReason, error: string | null, attempts: number, usage: AiUsage | null = null,
): Promise<void> {
  const d: Decision = { kind: "a_toi", reason, reasons: [reason] };
  await persist(admin, l, { reading: null, usage, real: d, theoretical: d, subjectId: null, sources: [], error, attempts });
}

// ---- The reading -----------------------------------------------------------------

function buildDecisionContext(
  l: Loaded, r: AiReading, knowledge: Record<string, { active: boolean; program_id: string | null }>,
  keyword: boolean, outboundSent: boolean,
): DecisionContext {
  const s = l.program.settings;
  const subject = l.subjects.find((x) => x.slug === r.sujet) ?? null;
  const q = subject ? l.quality.find((x) => x.subject_id === subject.id) : undefined;
  const triageThreshold = Number(l.mailbox?.triage_threshold ?? 0.7);
  return {
    programId: l.program.id,
    programActive: l.program.active,
    programPaused: s?.paused ?? true,
    mailboxPaused: l.mailbox?.paused ?? true,
    autoSendEnabled: s?.auto_send_enabled ?? false,
    confidenceThreshold: Number(s?.confidence_threshold ?? 0.85),
    autoStreakLimit: s?.auto_streak_limit ?? 3,
    editedThreshold: Number(s?.edited_threshold ?? 0.3),
    minReviewed: s?.auto_min_reviewed ?? 20,
    hasContext: !!l.context,
    subject: subject ? { slug: subject.slug, zone_rouge: subject.zone_rouge, auto_enabled: subject.auto_enabled } : null,
    redZoneCodes: [...new Set([...UNIVERSAL_RED_ZONE_CODES, ...l.zones.map((z) => z.code)])],
    autoStreak: l.thread.auto_streak,
    knowledge,
    matchMethod: l.message.match_method,
    triageUncertain: l.thread.triage_confidence !== null && l.thread.triage_confidence < triageThreshold,
    addressVerified: !!l.address?.verified_at,
    addressValid: l.address ? l.address.status === "valide" : false,
    contactOptedOut: !!l.contact?.do_not_contact,
    firstContact: l.program.direction === "sortant" && !outboundSent,
    quality: { reviewed: q?.relues_par_leo ?? 0, modifiedShare: q?.part_modifiee_20_dernieres ?? null },
    optOutKeyword: keyword,
  };
}

/**
 * Classifies one incoming message. `force` re-reads a message that already was
 * (replay button): attempts start again from zero.
 */
export async function classifyMessage(admin: Admin, messageId: string, opts: { force?: boolean } = {}): Promise<ClassifyOutcome> {
  const l = await load(admin, messageId);
  if (!l) return { status: "skipped", reason: "introuvable" };
  const m = l.message;
  if (m.kind !== "entrant" && m.kind !== "formulaire") return { status: "skipped", reason: "pas_un_message_humain" };
  if (m.classified_at && !opts.force) return { status: "skipped", reason: "deja_lu" };

  const attemptsBefore = opts.force ? 0 : m.ai_attempts ?? 0;
  if (attemptsBefore >= MAX_AI_ATTEMPTS) return { status: "skipped", reason: "essais_epuises" };

  // Claim: one attempt is consumed before the call, so two runs cannot read the same message twice.
  const claim = await admin.from("outreach_messages")
    .update({ ai_attempts: attemptsBefore + 1, ...(opts.force ? { classified_at: null } : {}) })
    .eq("id", m.id)
    .eq("ai_attempts", m.ai_attempts ?? 0)
    .select("id");
  if (claim.error || !claim.data || claim.data.length === 0) return { status: "skipped", reason: "pris_par_un_autre_passage" };
  const attempts = attemptsBefore + 1;

  const text = (m.body_reply || m.body_text || "").trim();

  // 1. Opposition in the words, before any model: immediate, whatever a model would say.
  if (hasOptOutKeyword(text)) {
    const d: Decision = { kind: "ignore", reason: "opposition", reasons: ["mots_cles"] };
    await persist(admin, l, { reading: null, usage: null, real: d, theoretical: d, subjectId: null, sources: [], error: null, attempts });
    return { status: "classified", decision: "ignore", reason: "opposition" };
  }

  // 2. No active context: no call (spec 7.1).
  if (!l.context) {
    await finishWithoutReading(admin, l, "contexte_absent", null, attempts);
    return { status: "classified", decision: "a_toi", reason: "contexte_absent" };
  }

  // 3. No key: nothing to retry until someone sets one; the replay button reads again.
  if (!aiConfigured()) {
    await finishWithoutReading(admin, l, "ia_indisponible", "cle_absente", attempts);
    return { status: "classified", decision: "a_toi", reason: "ia_indisponible" };
  }

  const currentSubject = l.subjects.find((s) => s.id === l.thread.current_subject_id) ?? null;
  const [knowledge, history, sent] = await Promise.all([
    loadKnowledgeForPrompt(admin, { programId: l.program.id, subjectId: currentSubject?.id ?? null, text }),
    threadHistory(admin, l.thread.id, m.id),
    admin.from("outreach_messages").select("id", { count: "exact", head: true })
      .eq("thread_id", l.thread.id).eq("direction", "out").eq("send_status", "envoye"),
  ]);
  const stage = stageBySlug(l.program, l.thread.status);
  const input: AiInput = {
    knowledge: knowledge.map((k) => ({ id: k.id, title: k.title, body: k.body })),
    facts: {
      stageSlug: l.thread.status,
      stageRole: stage?.role ?? "inconnu",
      subjectSlug: currentSubject?.slug ?? null,
      autoStreak: l.thread.auto_streak,
      actions: [
        l.thread.photos_granted_at ? "photos accordées" : null,
        l.thread.correction_requested_at ? "correction demandée" : null,
      ].filter((x): x is string => !!x),
      externalType: l.thread.external_type,
    },
    thread: history,
    message: { text: text || (m.body_text ?? "") },
  };

  const res = await readInbound(promptProgramOf(l), input);
  if (!res.ok) {
    console.error("[outreach-ai] reading failed:", res.error.split(":")[0]);
    if (attempts < MAX_AI_ATTEMPTS) {
      // Left unclassified: the next cron pass tries again.
      await admin.from("outreach_messages").update({ ai_error: res.error.slice(0, 120) }).eq("id", m.id);
      return { status: "deferred", reason: res.error };
    }
    const invalid = res.error.startsWith("sortie_invalide") || res.error === "sortie_tronquee";
    await finishWithoutReading(admin, l, invalid ? "ia_invalide" : "ia_indisponible", res.error, attempts, res.usage ?? null);
    return { status: "failed", reason: res.error };
  }

  const reading = res.reading;
  const known = await knowledgeByIds(admin, reading.sources);
  const dctx = buildDecisionContext(l, reading, known, false, (sent.count ?? 0) > 0);
  const real = decide(reading, dctx);
  const theoretical = decideTheoretical(reading, dctx);
  const subject = l.subjects.find((s) => s.slug === reading.sujet) ?? null;
  const validSources = [...new Set(reading.sources.filter((id) => known[id]))];

  await persist(admin, l, {
    reading, usage: res.usage, real, theoretical, subjectId: subject?.id ?? null,
    sources: validSources, error: null, attempts,
  });
  return {
    status: "classified",
    decision: real.kind,
    reason: real.kind === "a_toi" ? real.reason : real.kind === "ignore" ? real.reason : undefined,
    costUsd: estimateCostUsd(res.usage),
    usage: res.usage,
  };
}

export interface PendingRun {
  classified: number;
  deferred: number;
  failed: number;
  skipped: number;
  costUsd: number;
  configured: boolean;
}

/** One pass of the cron: the oldest unread human messages, within a time budget. */
export async function classifyPending(limit = 8, budgetMs = 200_000): Promise<PendingRun> {
  const run: PendingRun = { classified: 0, deferred: 0, failed: 0, skipped: 0, costUsd: 0, configured: aiConfigured() };
  const admin = createAdminClient();
  if (!admin) return run;
  const { data } = await admin.from("outreach_messages").select("id")
    .eq("direction", "in").in("kind", ["entrant", "formulaire"]).is("classified_at", null)
    .lt("ai_attempts", MAX_AI_ATTEMPTS).order("created_at", { ascending: true }).limit(limit);
  const started = Date.now();
  for (const row of (data ?? []) as { id: string }[]) {
    if (Date.now() - started > budgetMs) break;
    try {
      const o = await classifyMessage(admin, row.id);
      if (o.status === "classified") run.classified++;
      else if (o.status === "deferred") run.deferred++;
      else if (o.status === "failed") run.failed++;
      else run.skipped++;
      run.costUsd += o.costUsd ?? 0;
    } catch (err) {
      run.failed++;
      console.error("[outreach-ai] classify crashed:", err instanceof Error ? err.message.slice(0, 80) : "error");
    }
  }
  return run;
}

// ---- Triage of the shared mailboxes (spec 6.5) ---------------------------------------

/** Registered with setTriageHook() by the inbox cron. Any doubt -> uncertain (fallback program + "à toi"). */
export const triageInbound: TriageFn = async (mb, candidates, p) => {
  if (!aiConfigured()) return { kind: "uncertain" };
  const text = extractReply(p.text).reply || p.text;
  const res = await readTriage(
    candidates.map((c) => ({ slug: c.slug, description: c.description })),
    { subject: p.subject, text },
  );
  if (!res.ok) return { kind: "uncertain" };
  const admin = createAdminClient();
  if (admin) {
    await event(admin, "ai.triage", {
      mailbox: mb.key, chosen: res.triage.programme, confidence: round2(res.triage.confiance),
      model: res.usage.model, tokens_in: res.usage.input + res.usage.cacheRead, tokens_out: res.usage.output,
      cost_usd: Math.round(estimateCostUsd(res.usage) * 10000) / 10000,
    }, {});
  }
  const slug = res.triage.programme;
  const need = Math.max(0.85, Number(mb.triage_threshold));
  if (slug === "spam" || slug === "hors_sujet") {
    return res.triage.confiance >= need ? { kind: "ignore", reason: slug } : { kind: "uncertain" };
  }
  const chosen = candidates.find((c) => c.slug === slug);
  if (!chosen) return { kind: "uncertain" };
  return { kind: "program", programId: chosen.id, confidence: res.triage.confiance };
};

export { aiModel };
