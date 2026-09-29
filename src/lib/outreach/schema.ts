/**
 * Strict shape of what the AI returns (spec 7.2 and annex 16.1). Pure module:
 * no server-only import, no database, no secret. Loaded as is by
 * scripts/outreach-ai-check.mjs (so: type-only imports, no path alias).
 *
 * The JSON schema sent to the API is the same for every program; the program
 * specific checks (subject, red zones, sources) are done afterwards by the code
 * (classify.ts and decide.ts), because a per-program enumeration would change the
 * schema, hence the prompt-cache prefix, for each program.
 */

export const AI_INTENTS = [
  "remerciement", "avis", "question", "accord_photos", "refus_photos", "demande_correction",
  "demande_retrait", "interet_casa_minga", "demande_inscription", "proposition_partenariat",
  "demande_aide", "signalement", "confirmation_resolution", "envoi_justificatif", "refus",
  "desinscription", "reponse_absence", "hors_sujet", "autre",
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

/** Universal red zones (spec 16.4). A program never redefines one of these codes. */
export const UNIVERSAL_RED_ZONE_CODES = [
  "argent", "identite", "engagement", "donnees_personnelles", "litige", "hors_corpus",
] as const;

export interface AiReading {
  sujet: string;
  intention: AiIntent;
  confiance: number;
  zone_rouge: boolean;
  zones_rouges: string[];
  opposition: boolean;
  sources: string[];
  resume: string;
  brouillon: string | null;
  besoin_humain: string | null;
}

export interface AiTriage {
  programme: string;
  confiance: number;
}

export const READING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sujet", "intention", "confiance", "zone_rouge", "zones_rouges", "opposition", "sources", "resume", "brouillon", "besoin_humain"],
  properties: {
    sujet: { type: "string" },
    intention: { type: "string", enum: [...AI_INTENTS] },
    confiance: { type: "number" },
    zone_rouge: { type: "boolean" },
    zones_rouges: { type: "array", items: { type: "string" } },
    opposition: { type: "boolean" },
    sources: { type: "array", items: { type: "string" } },
    resume: { type: "string" },
    brouillon: { type: ["string", "null"] },
    besoin_humain: { type: ["string", "null"] },
  },
} as const;

export const TRIAGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["programme", "confiance"],
  properties: {
    programme: { type: "string" },
    confiance: { type: "number" },
  },
} as const;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const READING_KEYS = new Set(READING_JSON_SCHEMA.required as readonly string[]);
const MAX_LIST = 40;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= MAX_LIST && v.every((x) => typeof x === "string" && x.length <= 200);
}

/** Text -> JSON, tolerating a Markdown fence around the object. */
export function parseJsonText(text: string): unknown {
  const t = (text ?? "").trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : t);
}

/** Validates an already parsed value. The error names the field, never a value. */
export function parseReading(raw: unknown): Parsed<AiReading> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "not_an_object" };
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!READING_KEYS.has(k)) return { ok: false, error: `unknown_field:${k}` };
  for (const k of READING_KEYS) if (!(k in o)) return { ok: false, error: `missing_field:${k}` };

  if (typeof o.sujet !== "string" || !/^[a-z0-9_]{2,40}$/.test(o.sujet)) return { ok: false, error: "bad_field:sujet" };
  if (typeof o.intention !== "string" || !(AI_INTENTS as readonly string[]).includes(o.intention)) return { ok: false, error: "bad_field:intention" };
  if (typeof o.confiance !== "number" || !Number.isFinite(o.confiance) || o.confiance < 0 || o.confiance > 1) return { ok: false, error: "bad_field:confiance" };
  if (typeof o.zone_rouge !== "boolean") return { ok: false, error: "bad_field:zone_rouge" };
  if (!isStringArray(o.zones_rouges)) return { ok: false, error: "bad_field:zones_rouges" };
  if (typeof o.opposition !== "boolean") return { ok: false, error: "bad_field:opposition" };
  if (!isStringArray(o.sources)) return { ok: false, error: "bad_field:sources" };
  if (typeof o.resume !== "string" || o.resume.length > 1000) return { ok: false, error: "bad_field:resume" };
  if (o.brouillon !== null && (typeof o.brouillon !== "string" || o.brouillon.length > 8000)) return { ok: false, error: "bad_field:brouillon" };
  if (o.besoin_humain !== null && (typeof o.besoin_humain !== "string" || o.besoin_humain.length > 1000)) return { ok: false, error: "bad_field:besoin_humain" };

  return {
    ok: true,
    value: {
      sujet: o.sujet,
      intention: o.intention as AiIntent,
      confiance: o.confiance,
      zone_rouge: o.zone_rouge,
      zones_rouges: o.zones_rouges,
      opposition: o.opposition,
      sources: o.sources,
      resume: o.resume,
      brouillon: o.brouillon === null ? null : (o.brouillon as string).trim() || null,
      besoin_humain: o.besoin_humain === null ? null : (o.besoin_humain as string).trim() || null,
    },
  };
}

export function parseReadingText(text: string): Parsed<AiReading> {
  let raw: unknown;
  try {
    raw = parseJsonText(text);
  } catch {
    return { ok: false, error: "not_json" };
  }
  return parseReading(raw);
}

export function parseTriage(raw: unknown): Parsed<AiTriage> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "not_an_object" };
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 2 || !keys.includes("programme") || !keys.includes("confiance")) return { ok: false, error: "bad_shape" };
  if (typeof o.programme !== "string" || o.programme.length > 80) return { ok: false, error: "bad_field:programme" };
  if (typeof o.confiance !== "number" || !Number.isFinite(o.confiance) || o.confiance < 0 || o.confiance > 1) return { ok: false, error: "bad_field:confiance" };
  return { ok: true, value: { programme: o.programme, confiance: o.confiance } };
}

export function parseTriageText(text: string): Parsed<AiTriage> {
  try {
    return parseTriage(parseJsonText(text));
  } catch {
    return { ok: false, error: "not_json" };
  }
}
