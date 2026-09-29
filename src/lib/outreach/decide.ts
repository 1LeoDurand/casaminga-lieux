/**
 * The decision rule applied to an AI reading (spec 7.4). PURE: no database, no
 * network, no clock. The model proposes, this function disposes.
 *
 * `decide` returns "auto" only when EVERY condition holds, among them the
 * program switch `autoSendEnabled` (false everywhere in v1). Anything else is
 * "a_toi" with the reasons, or "ignore" (out-of-office, opposition).
 *
 * `decideTheoretical` answers "what would the automatic mode have done if it had
 * been on for this subject" (spec 7.7, metric "décisions auto théoriques"): it
 * lifts the three switches (program, subject, barrier) and nothing else. It only
 * feeds statistics; nothing is ever sent from its result.
 */
import type { AiReading } from "./schema";
import type { NeedsLeoReason } from "./types";

export interface DecisionKnowledge {
  active: boolean;
  /** null = shared by every program. */
  program_id: string | null;
}

export interface DecisionContext {
  programId: string;
  programActive: boolean;
  programPaused: boolean;
  mailboxPaused: boolean;
  /** outreach_settings.auto_send_enabled: the master switch of the program. */
  autoSendEnabled: boolean;
  confidenceThreshold: number;
  autoStreakLimit: number;
  /** Share of modified drafts above which the subject is cut (30 %). */
  editedThreshold: number;
  /** Replies reviewed by Leo required on the subject (20). */
  minReviewed: number;
  hasContext: boolean;
  /** The subject the AI named, resolved in the program; null = unknown to the program. */
  subject: { slug: string; zone_rouge: boolean; auto_enabled: boolean } | null;
  /** Universal and program red zone codes. */
  redZoneCodes: string[];
  autoStreak: number;
  /** Knowledge entries by id (the ones that exist). */
  knowledge: Record<string, DecisionKnowledge>;
  /** How the incoming mail was attached to its thread. */
  matchMethod: string | null;
  triageUncertain: boolean;
  addressVerified: boolean;
  addressValid: boolean;
  contactOptedOut: boolean;
  /** Our reply would be the first mail we send in an outbound program's thread. */
  firstContact: boolean;
  /** Quality of the subject: replies reviewed and share of them edited (last 20). */
  quality: { reviewed: number; modifiedShare: number | null };
  /** An opt-out phrase was found in the text before the AI read it. */
  optOutKeyword?: boolean;
}

export type Decision =
  | { kind: "auto"; reasons: string[] }
  | { kind: "a_toi"; reason: NeedsLeoReason; reasons: string[] }
  | { kind: "ignore"; reason: "absence" | "opposition"; reasons: string[] };

export const DRAFT_MAX_CHARS = 1200;
export const ALLOWED_LINK_HOSTS = ["casaminga.com", "sejour.casaminga.com"];
const RELIABLE_MATCH = new Set(["in_reply_to", "references", "adresse_sujet", "nouveau_fil", "formulaire", "admin"]);
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()"'\]]+/gi;

/** Problems with the links of a draft: more than one, or a host outside the allowed list. */
export function draftLinkProblems(text: string): string[] {
  const found = text.match(URL_RE) ?? [];
  const problems: string[] = [];
  if (found.length > 1) problems.push("plusieurs_liens");
  for (const raw of found) {
    let host = "";
    try {
      host = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw).hostname.toLowerCase();
    } catch {
      problems.push("lien_illisible");
      continue;
    }
    if (!ALLOWED_LINK_HOSTS.includes(host)) problems.push("lien_hors_domaine");
  }
  return [...new Set(problems)];
}

interface Reason { code: NeedsLeoReason; detail: string }

function collect(r: AiReading, c: DecisionContext, theoretical: boolean): Reason[] {
  const out: Reason[] = [];
  const add = (code: NeedsLeoReason, detail: string) => out.push({ code, detail });

  // 1. Nothing to read with, or an unusable reading.
  if (!c.hasContext) add("contexte_absent", "contexte_absent");
  if (!c.subject) add("ia_invalide", "sujet_inconnu");
  const unknownZones = r.zones_rouges.filter((z) => !c.redZoneCodes.includes(z));
  if (unknownZones.length > 0) add("ia_invalide", "zone_inconnue");

  // 2. Red zones: any one is enough, and so is a red-zone subject.
  const zones = r.zones_rouges.filter((z) => c.redZoneCodes.includes(z));
  const onlyOutOfCorpus = zones.length > 0 && zones.every((z) => z === "hors_corpus");
  if (r.zone_rouge || zones.length > 0 || c.subject?.zone_rouge) {
    if (onlyOutOfCorpus && !c.subject?.zone_rouge) add("hors_corpus", "zone:hors_corpus");
    else add("zone_rouge", zones.length ? `zone:${zones.join("+")}` : c.subject?.zone_rouge ? "sujet_zone_rouge" : "zone_rouge_declaree");
  }

  // 3. Sources: at least one, every one existing, active, shared or of the program.
  if (r.sources.length === 0) add("hors_corpus", "aucune_source");
  else {
    for (const id of r.sources) {
      const k = c.knowledge[id];
      if (!k) { add("ia_invalide", "source_inconnue"); break; }
    }
    const bad = r.sources.some((id) => {
      const k = c.knowledge[id];
      return !!k && (!k.active || (k.program_id !== null && k.program_id !== c.programId));
    });
    if (bad) add("hors_corpus", "source_inactive_ou_hors_perimetre");
  }

  // 4. The intention and the draft.
  if (r.intention === "refus") add("refus", "intention_refus");
  if (r.besoin_humain) add("autre", "besoin_humain");
  if (!r.brouillon) add("autre", "brouillon_absent");
  else {
    if (r.brouillon.length > DRAFT_MAX_CHARS) add("ia_invalide", "brouillon_trop_long");
    for (const p of draftLinkProblems(r.brouillon)) add("ia_invalide", p);
  }
  if (r.confiance < c.confidenceThreshold) add("confiance", `confiance<${c.confidenceThreshold}`);

  // 5. Attachment and identity of the sender.
  if (!RELIABLE_MATCH.has(c.matchMethod ?? "")) add("rattachement_incertain", `rattachement:${c.matchMethod ?? "inconnu"}`);
  if (c.triageUncertain) add("tri_incertain", "tri_incertain");
  if (!c.addressVerified) add("adresse_non_verifiee", "adresse_non_verifiee");
  if (c.contactOptedOut || !c.addressValid) add("envoi_bloque", c.contactOptedOut ? "contact_ne_plus_ecrire" : "adresse_invalide");
  if (c.firstContact) add("autre", "premier_contact");

  // 6. Pauses and the automatic switches.
  if (!c.programActive) add("envoi_bloque", "programme_inactif");
  if (c.programPaused) add("envoi_bloque", "programme_en_pause");
  if (c.mailboxPaused) add("envoi_bloque", "boite_en_pause");
  if (c.autoStreak >= c.autoStreakLimit) add("limite_auto", `affilee>=${c.autoStreakLimit}`);
  if (!theoretical) {
    if (c.subject && !c.subject.auto_enabled) add("sujet_non_auto", "sujet_non_automatique");
    if (c.quality.reviewed < c.minReviewed) add("sujet_non_auto", `relues<${c.minReviewed}`);
    else if (c.quality.modifiedShare === null || c.quality.modifiedShare >= c.editedThreshold) add("auto_coupe", "part_modifiee");
    if (!c.autoSendEnabled) add("auto_coupe", "envoi_automatique_coupe");
  }
  return out;
}

function ignoreOf(r: AiReading, c: DecisionContext): Decision | null {
  if (r.intention === "reponse_absence") return { kind: "ignore", reason: "absence", reasons: ["reponse_absence"] };
  if (r.opposition || r.intention === "desinscription" || c.optOutKeyword) {
    const why = [r.opposition ? "opposition_ia" : null, r.intention === "desinscription" ? "intention_desinscription" : null, c.optOutKeyword ? "mots_cles" : null]
      .filter((x): x is string => !!x);
    return { kind: "ignore", reason: "opposition", reasons: why };
  }
  return null;
}

/** The real decision. Never "auto" unless every condition holds, program switch included. */
export function decide(r: AiReading, c: DecisionContext): Decision {
  const ignored = ignoreOf(r, c);
  if (ignored) return ignored;
  const reasons = collect(r, c, false);
  if (reasons.length === 0 && c.autoSendEnabled) return { kind: "auto", reasons: [] };
  if (reasons.length === 0) return { kind: "a_toi", reason: "auto_coupe", reasons: ["envoi_automatique_coupe"] };
  return { kind: "a_toi", reason: reasons[0].code, reasons: reasons.map((x) => x.detail) };
}

/** What the automatic mode would have done with the three switches on. Statistics only. */
export function decideTheoretical(r: AiReading, c: DecisionContext): Decision {
  const ignored = ignoreOf(r, c);
  if (ignored) return ignored;
  // A red-zone subject can never be opened to automatic mode: it stays "à toi" here too.
  const reasons = collect(r, c, true);
  if (reasons.length === 0) return { kind: "auto", reasons: [] };
  return { kind: "a_toi", reason: reasons[0].code, reasons: reasons.map((x) => x.detail) };
}
