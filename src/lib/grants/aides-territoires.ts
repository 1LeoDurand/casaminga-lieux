import "server-only";
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

function mapAid(aid: AtAid): ImportedOpportunity {
  const financer = aid.financers?.[0] ?? null;
  return {
    external_id: String(aid.id),
    title: aid.name,
    funder: financer,
    funder_type: guessFunderType(financer),
    themes: aid.categories ?? [],
    regions: aid.perimeter ? [aid.perimeter] : [],
    structure_types: [],
    amount_min: aid.subvention_rate_lower_bound ?? null,
    amount_max: aid.subvention_rate_upper_bound ?? null,
    deadline: aid.submission_deadline ?? null,
    recurring: !!aid.recurrence && aid.recurrence !== "oneoff",
    application_url: aid.application_url ?? aid.origin_url ?? aid.url ?? null,
    required_documents: [],
    description: stripHtml(aid.description),
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
