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
import { createHash } from "node:crypto";
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

// ---- Published help articles as a source (centre d'aide, step 6) -----------
// Read straight from help_articles at every classification, never copied into
// outreach_knowledge: an article that is unpublished leaves the prompt at once.

/** Program slug -> help audience it reads. A program that is not here reads no help. */
export const HELP_AUDIENCE_BY_PROGRAM: Record<string, string> = {
  "sav-sejour": "sejour",
};

/** Public site of each help audience (article url = base + slug). */
export const HELP_BASE_URL_BY_AUDIENCE: Record<string, string> = {
  sejour: "https://sejour.casaminga.com/aide/",
};

/**
 * Help category slug -> subject slug of the program (outreach_subjects.slug).
 * A category that is not here gives no subject: the article is "general".
 * Red-zone subjects (remboursement, signalement) are deliberately not fed.
 */
export const HELP_SUBJECT_BY_CATEGORY: Record<string, Record<string, string>> = {
  "sav-sejour": {
    "sejour-sejourner": "sejour",
    "sejour-accueillir": "sejour",
    "sejour-points": "points_hospitalite",
    "sejour-confiance": "compte",
    "sejour-compte": "compte",
  },
};

/** Articles kept per group (thread subject, full-text matches, general). */
export const HELP_ARTICLES_PER_GROUP = 5;
const HELP_BODY_MAX = 2500;

export interface HelpArticleRow {
  slug: string;
  category_slug: string | null;
  title: string;
  excerpt: string | null;
  keywords: string[] | null;
  body: string | null;
}

/** Stable uuid derived from the slug: ai_sources is a uuid[] and these articles are not in outreach_knowledge. */
export function helpArticleId(audience: string, slug: string): string {
  const h = createHash("sha1").update(`help:${audience}:${slug}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** An article as a "page" entry (text = title + excerpt + body, public url). */
export function helpArticleToEntry(
  a: HelpArticleRow,
  o: { programId: string; programSlug: string; audience: string; subjects: { id: string; slug: string }[] },
): KnowledgeEntry {
  const subjectSlug = a.category_slug ? HELP_SUBJECT_BY_CATEGORY[o.programSlug]?.[a.category_slug] : undefined;
  const subject = subjectSlug ? o.subjects.find((s) => s.slug === subjectSlug) : undefined;
  const text = [a.title, a.excerpt ?? "", (a.body ?? "").trim()].filter((x) => x.trim() !== "").join("\n\n");
  const base = HELP_BASE_URL_BY_AUDIENCE[o.audience] ?? "";
  return {
    id: helpArticleId(o.audience, a.slug),
    program_id: o.programId,
    kind: "page",
    subject_id: subject?.id ?? null,
    title: a.title,
    question: null,
    body: text.length > HELP_BODY_MAX ? `${text.slice(0, HELP_BODY_MAX)} […]` : text,
    source_url: `${base}${a.slug}`,
    source_message_id: null,
    active: true,
    reviewed_at: null,
    created_by: "aide",
    created_at: "",
    updated_at: "",
  };
}

/**
 * The help entries worth a place in the prompt: the N best of the thread's
 * subject, the N best matches of the incoming text (any subject), the N first
 * general ones. Relevance = number of the message's words found in the entry.
 */
export function pickHelpEntries(
  entries: KnowledgeEntry[],
  text: string,
  subjectId: string | null,
  n = HELP_ARTICLES_PER_GROUP,
): { subject: KnowledgeEntry[]; matches: KnowledgeEntry[]; general: KnowledgeEntry[] } {
  const q = ftsQueryFromText(text);
  const words = q ? q.split(" | ") : [];
  const score = (e: KnowledgeEntry) => {
    const hay = `${e.title} ${e.body}`.toLowerCase();
    return words.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
  };
  const ranked = (list: KnowledgeEntry[]) =>
    list.map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s).map((x) => x.e);
  const limit = Math.max(0, Math.floor(n));
  const subject = subjectId ? ranked(entries.filter((e) => e.subject_id === subjectId)).slice(0, limit) : [];
  const matches = ranked(entries.filter((e) => score(e) > 0)).slice(0, limit);
  const general = ranked(entries.filter((e) => e.subject_id === null)).slice(0, limit);
  return { subject, matches, general };
}

async function readHelpArticles(admin: SupabaseClient, audience: string): Promise<HelpArticleRow[]> {
  const { data, error } = await admin
    .from("help_articles")
    .select("slug, category_slug, title, excerpt, keywords, body")
    .eq("published", true)
    .eq("audience", audience)
    .limit(300);
  if (error) return [];
  return (data ?? []) as HelpArticleRow[];
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
  /** Slug of the program and its subjects: needed to add the published help articles. */
  programSlug?: string;
  subjects?: { id: string; slug: string }[];
  /** Help articles kept per group, default HELP_ARTICLES_PER_GROUP. */
  helpPerGroup?: number;
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
  const audience = q.programSlug ? HELP_AUDIENCE_BY_PROGRAM[q.programSlug] : undefined;
  if (audience && q.programSlug) {
    const rows = await readHelpArticles(admin, audience);
    const help = rows.map((a) =>
      helpArticleToEntry(a, { programId: q.programId, programSlug: q.programSlug!, audience, subjects: q.subjects ?? [] }),
    );
    const picked = pickHelpEntries(help, q.text, q.subjectId, q.helpPerGroup);
    subject.push(...picked.subject);
    matches.push(...picked.matches);
    generalRest.push(...picked.general);
  }
  return fitBudget({ rules, subject, matches, general: generalRest }, q.maxTokens ?? PROMPT_TOKEN_BUDGET);
}

/**
 * The entries an AI reading named, whatever their state, to check them (decide.ts rule 7).
 * With `program`, the ids of that program's published help articles resolve too.
 */
export async function knowledgeByIds(
  admin: SupabaseClient,
  ids: string[],
  program?: { id: string; slug: string },
): Promise<Record<string, { active: boolean; program_id: string | null }>> {
  const valid = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return {};
  const { data } = await admin.from("outreach_knowledge").select("id, active, program_id").in("id", valid);
  const map: Record<string, { active: boolean; program_id: string | null }> = {};
  for (const r of (data ?? []) as { id: string; active: boolean; program_id: string | null }[]) {
    map[r.id] = { active: r.active, program_id: r.program_id };
  }
  const audience = program ? HELP_AUDIENCE_BY_PROGRAM[program.slug] : undefined;
  if (program && audience && valid.some((id) => !map[id])) {
    for (const a of await readHelpArticles(admin, audience)) {
      const id = helpArticleId(audience, a.slug);
      if (valid.includes(id) && !map[id]) map[id] = { active: true, program_id: program.id };
    }
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
