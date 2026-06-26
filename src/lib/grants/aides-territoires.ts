import "server-only";
import { createAdminClient } from "@/lib/admin/guard";
import type { FunderType } from "./types";

/**
 * Import depuis l'API publique Aides-Territoires (Lot 12 P4).
 * https://aides-territoires.beta.gouv.fr/api/
 *
 * Auth : un jeton long (AIDES_TERRITOIRES_API_KEY) est échangé contre un
 * bearer court via /api/connexion/, puis on pagine /api/aids/.
 * Chaque aide importée garde son `external_id` (= id AT) pour l'anti-doublon.
 * Les imports arrivent en `published: false` : le super-admin relit avant
 * de les rendre visibles aux lieux.
 */

const AT_BASE = "https://aides-territoires.beta.gouv.fr";

/** Forme normalisée d'une aide, prête à upserter dans grant_opportunities. */
export interface ImportedOpportunity {
  external_id: string;
  title: string;
  funder: string | null;
  funder_type: FunderType | null;
  themes: string[];
  regions: string[];
  structure_types: string[];
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  recurring: boolean;
  application_url: string | null;
  required_documents: string[];
  description: string | null;
}

interface AtAid {
  id: number;
  name: string;
  financers?: string[];
  perimeter?: string | null;
  categories?: string[];
  targeted_audiences?: string[];
  subvention_rate_lower_bound?: number | null;
  subvention_rate_upper_bound?: number | null;
  submission_deadline?: string | null;
  recurrence?: string | null;
  origin_url?: string | null;
  application_url?: string | null;
  url?: string | null;
  description?: string | null;
  aid_types?: string[];
}

/** Retire les balises HTML d'une description AT (texte brut pour notre champ). */
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length ? text.slice(0, 2000) : null;
}

/** Déduit grossièrement le type de financeur depuis le nom (heuristique). */
function guessFunderType(financer: string | null): FunderType | null {
  if (!financer) return null;
  const f = financer.toLowerCase();
  if (f.includes("région")) return "region";
  if (f.includes("départe")) return "departement";
  if (f.includes("europe") || f.includes("feder") || f.includes("union européenne")) return "europe";
  if (f.includes("fondation")) return "fondation";
  if (f.includes("état") || f.includes("ministère") || f.includes("ademe") || f.includes("drac") || f.includes("préfecture")) return "etat";
  return "autre";
}

/**
 * Phrase « Taux de subvention » à partir des bornes AT.
 * ⚠️ `subvention_rate_lower/upper_bound` sont des TAUX en % (ex. 50, 80, 90),
 * PAS des montants en euros — on ne les met donc jamais dans amount_min/max.
 */
function subventionRateLine(lower?: number | null, upper?: number | null): string | null {
  if (lower != null && upper != null) {
    return lower === upper
      ? `💶 Taux de subvention : ${upper} %`
      : `💶 Taux de subvention : de ${lower} à ${upper} %`;
  }
  if (upper != null) return `💶 Taux de subvention : jusqu'à ${upper} %`;
  if (lower != null) return `💶 Taux de subvention : à partir de ${lower} %`;
  return null;
}

function mapAid(aid: AtAid): ImportedOpportunity {
  const financer = aid.financers?.[0] ?? null;
  const rateLine = subventionRateLine(aid.subvention_rate_lower_bound, aid.subvention_rate_upper_bound);
  const body = stripHtml(aid.description);
  const description = rateLine
    ? [rateLine, body].filter(Boolean).join("\n\n").slice(0, 2000)
    : body;
  return {
    external_id: String(aid.id),
    title: aid.name,
    funder: financer,
    funder_type: guessFunderType(financer),
    themes: aid.categories ?? [],
    regions: aid.perimeter ? [aid.perimeter] : [],
    structure_types: [],
    // AT ne fournit pas de montant € fixe pour ces aides (seulement un taux) → null.
    amount_min: null,
    amount_max: null,
    deadline: aid.submission_deadline ?? null,
    recurring: !!aid.recurrence && aid.recurrence !== "oneoff",
    application_url: aid.application_url ?? aid.origin_url ?? aid.url ?? null,
    required_documents: [],
    description,
  };
}

/** Échange la clé API longue contre un bearer court. */
async function getBearer(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${AT_BASE}/api/connexion/`, {
      method: "POST",
      headers: { "X-AUTH-TOKEN": apiKey },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export type FetchResult =
  | { ok: true; opportunities: ImportedOpportunity[] }
  | { ok: false; error: string };

/**
 * Récupère jusqu'à `maxAids` aides ouvertes depuis Aides-Territoires.
 * Filtrées sur les structures associatives par défaut (audience).
 */
export async function fetchAidesTerritoires(maxAids = 50): Promise<FetchResult> {
  const apiKey = process.env.AIDES_TERRITOIRES_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Clé API Aides-Territoires non configurée (AIDES_TERRITOIRES_API_KEY)." };
  }

  const bearer = await getBearer(apiKey);
  if (!bearer) {
    return { ok: false, error: "Authentification Aides-Territoires refusée — vérifiez la clé API." };
  }

  const collected: ImportedOpportunity[] = [];
  let url: string | null =
    `${AT_BASE}/api/aids/?targeted_audiences=association&order_by=submission_deadline`;

  try {
    while (url && collected.length < maxAids) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
      if (!res.ok) {
        return { ok: false, error: `Aides-Territoires a répondu ${res.status}.` };
      }
      const page = (await res.json()) as { results?: AtAid[]; next?: string | null };
      for (const aid of page.results ?? []) {
        if (aid?.id && aid?.name) collected.push(mapAid(aid));
        if (collected.length >= maxAids) break;
      }
      url = page.next ?? null;
    }
  } catch {
    return { ok: false, error: "Erreur réseau lors de l'appel à Aides-Territoires." };
  }

  return { ok: true, opportunities: collected };
}

export type SyncResult =
  | { ok: true; imported: number; updated: number }
  | { ok: false; error: string };

/**
 * Fetch + upsert dans grant_opportunities (logique partagée bouton admin /
 * cron). Anti-doublon par external_id : les nouvelles aides arrivent en
 * `published: false` (relecture super-admin avant publication), les
 * existantes voient leurs champs volatils rafraîchis sans toucher published.
 */
export async function syncAidesTerritoires(maxAids = 50): Promise<SyncResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };

  const res = await fetchAidesTerritoires(maxAids);
  if (!res.ok) return { ok: false, error: res.error };

  const externalIds = res.opportunities.map((o) => o.external_id);
  const { data: existing } = await admin
    .from("grant_opportunities")
    .select("id, external_id")
    .eq("source", "aides-territoires")
    .in("external_id", externalIds);
  const byExtId = new Map((existing ?? []).map((r) => [r.external_id as string, r.id as string]));

  let imported = 0;
  let updated = 0;
  for (const o of res.opportunities) {
    const existingId = byExtId.get(o.external_id);
    if (existingId) {
      const { error } = await admin
        .from("grant_opportunities")
        .update({
          title: o.title, funder: o.funder, funder_type: o.funder_type,
          themes: o.themes, regions: o.regions, amount_min: o.amount_min,
          amount_max: o.amount_max, deadline: o.deadline, recurring: o.recurring,
          application_url: o.application_url, description: o.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);
      if (!error) updated++;
    } else {
      const { error } = await admin.from("grant_opportunities").insert({
        ...o, source: "aides-territoires", published: false,
        updated_at: new Date().toISOString(),
      });
      if (!error) imported++;
    }
  }

  return { ok: true, imported, updated };
}
