/**
 * Knowledge base of the AI (spec 7.1 bloc C, 7.6): pages, corpus, rules and
 * approved answers, shared (program_id null) or of one program.
 *
 * Reads are filtered: active entries, shared + the program's, general ones
 * (no subject) + the thread's subject, plus the best full-text matches of the
 * incoming message (french tsvector `fts`), 6 000 tokens at most. The Supabase
 * client is INJECTED and there is no server-only import, so
 * scripts/outreach-ai-check.mjs can load the pure helpers as they are.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeKind = "page" | "corpus" | "approuvee" | "regle";

export interface KnowledgeEntry {
  id: string;
  program_id: string | null;
  kind: KnowledgeKind;
  subject_id: string | null;
  title: string;
  question: string | null;
  body: string;
  source_url: string | null;
  source_message_id: string | null;
  active: boolean;
  reviewed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const KIND_LABELS: Record<KnowledgeKind, string> = {
  page: "Page du site",
  corpus: "Corpus",
  approuvee: "Réponse approuvée",
  regle: "Règle",
};

const COLUMNS =
  "id, program_id, kind, subject_id, title, question, body, source_url, source_message_id, active, reviewed_at, created_by, created_at, updated_at";
export const PROMPT_TOKEN_BUDGET = 6000;
export const FTS_LIMIT = 8;
/** French text: about 3.3 characters per token. Only used to respect the budget. */
export function approxTokens(s: string): number {
  return Math.ceil((s ?? "").length / 3.3);
}

/** Text an entry costs in the prompt: "[id] title : body". */
export function entryTokens(e: Pick<KnowledgeEntry, "id" | "title" | "body">): number {
  return approxTokens(`[${e.id}] ${e.title} : ${e.body}`);
}

const STOP = new Set([
  "avec", "dans", "pour", "vous", "nous", "cette", "votre", "notre", "leur", "leurs", "mais", "donc", "être",
  "avoir", "fait", "faire", "comme", "aussi", "plus", "moins", "tout", "tous", "sont", "elle", "elles", "ils",
  "sans", "sous", "chez", "bonjour", "merci", "cordialement", "madame", "monsieur", "très", "bien", "veuillez",
]);

/**
 * A to_tsquery expression (OR of words) from free text, or null. Only letters and
 * digits survive, so nothing the mail says can add an operator to the query.
 */
export function ftsQueryFromText(text: string, maxWords = 12): string | null {
  const words = (text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && w.length <= 30 && !STOP.has(w) && !/^\d+$/.test(w));
  const uniq = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, maxWords);
  return uniq.length > 0 ? uniq.join(" | ") : null;
}

const KIND_PRIORITY: Record<KnowledgeKind, number> = { regle: 0, approuvee: 1, page: 2, corpus: 3 };

/**
 * Keeps the entries in priority order until the budget is used up: rules first,
 * then the thread's subject, then the full-text matches, then the general rest.
 * An entry that does not fit is skipped (a smaller one behind it may still fit).
 */
export function fitBudget(
  groups: { rules: KnowledgeEntry[]; subject: KnowledgeEntry[]; matches: KnowledgeEntry[]; general: KnowledgeEntry[] },
  maxTokens = PROMPT_TOKEN_BUDGET,
): KnowledgeEntry[] {
  const seen = new Set<string>();
  const out: KnowledgeEntry[] = [];
  let used = 0;
  const byKind = (a: KnowledgeEntry, b: KnowledgeEntry) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
  for (const list of [groups.rules, groups.subject, groups.matches, groups.general]) {
    for (const e of [...list].sort(byKind)) {
      if (seen.has(e.id)) continue;
      const t = entryTokens(e);
      if (used + t > maxTokens) continue;
      seen.add(e.id);
      out.push(e);
      used += t;
    }
  }
  return out;
}

export interface KnowledgeQuery {
  programId: string;
  subjectId: string | null;
  /** The incoming message, for the full-text matches. */
  text: string;
  maxTokens?: number;
}

/** Entries for the prompt of one incoming message. Never throws: an error gives what was read so far. */
export async function loadKnowledgeForPrompt(admin: SupabaseClient, q: KnowledgeQuery): Promise<KnowledgeEntry[]> {
  const scope = `program_id.is.null,program_id.eq.${q.programId}`;

  const general = await admin
    .from("outreach_knowledge")
    .select(COLUMNS)
    .eq("active", true)
    .or(scope)
    .order("kind")
    .order("created_at")
    .limit(200);
  const all = ((general.data ?? []) as KnowledgeEntry[]);

  const rules = all.filter((e) => e.kind === "regle" && (e.subject_id === null || e.subject_id === q.subjectId));
  const subject = q.subjectId ? all.filter((e) => e.subject_id === q.subjectId && e.kind !== "regle") : [];
  const generalRest = all.filter((e) => e.subject_id === null && e.kind !== "regle");

  let matches: KnowledgeEntry[] = [];
  const query = ftsQueryFromText(q.text);
  if (query) {
    const m = await admin
      .from("outreach_knowledge")
      .select(COLUMNS)
      .eq("active", true)
      .or(scope)
      .textSearch("fts", query, { config: "french" })
      .limit(FTS_LIMIT);
    matches = ((m.data ?? []) as KnowledgeEntry[]);
  }
  return fitBudget({ rules, subject, matches, general: generalRest }, q.maxTokens ?? PROMPT_TOKEN_BUDGET);
}

/** The entries an AI reading named, whatever their state, to check them (decide.ts rule 7). */
export async function knowledgeByIds(
  admin: SupabaseClient,
  ids: string[],
): Promise<Record<string, { active: boolean; program_id: string | null }>> {
  const valid = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return {};
  const { data } = await admin.from("outreach_knowledge").select("id, active, program_id").in("id", valid);
  const map: Record<string, { active: boolean; program_id: string | null }> = {};
  for (const r of (data ?? []) as { id: string; active: boolean; program_id: string | null }[]) {
    map[r.id] = { active: r.active, program_id: r.program_id };
  }
  return map;
}

/** Entries of the settings screen: shared + the program's, inactive ones included. */
export async function listKnowledge(admin: SupabaseClient, programId: string): Promise<KnowledgeEntry[]> {
  const { data } = await admin
    .from("outreach_knowledge")
    .select(COLUMNS)
    .or(`program_id.is.null,program_id.eq.${programId}`)
    .order("active", { ascending: false })
    .order("kind")
    .order("title");
  return (data ?? []) as KnowledgeEntry[];
}
