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
  // Taux de subvention en % — l'API expose les deux nominations selon la version.
  subvention_rate_min?: number | null;
  subvention_rate_max?: number | null;
  subvention_rate_lower_bound?: number | null;
  subvention_rate_upper_bound?: number | null;
  subvention_comment?: string | null;      // détail des montants/plafonds (texte)
  loan_amount?: number | null;             // montant d'un prêt (€)
  recoverable_advance_amount?: number | null; // avance récupérable (€)
  other_financial_aid_comment?: string | null;
  submission_deadline?: string | null;
  recurrence?: string | null;
  origin_url?: string | null;
  application_url?: string | null;
  url?: string | null;
  description?: string | null;
  aid_types?: string[];
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

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
 * ⚠️ Le taux est en % (ex. 50, 80, 90), PAS un montant en euros.
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

/**
 * Construit une description riche réunissant TOUTES les infos financières utiles :
 * taux, plafonds/conditions (subvention_comment), prêt, avance récupérable,
 * puis le descriptif de l'aide. C'est là que vit l'info « montant » côté AT.
 */
function buildDescription(aid: AtAid): string | null {
  const lines: string[] = [];

  const rate = subventionRateLine(
    aid.subvention_rate_min ?? aid.subvention_rate_lower_bound,
    aid.subvention_rate_max ?? aid.subvention_rate_upper_bound,
  );
  if (rate) lines.push(rate);

  const comment = stripHtml(aid.subvention_comment);
  if (comment) lines.push(`💬 Montants & conditions : ${comment}`);

  if (aid.loan_amount != null) lines.push(`🏦 Prêt : jusqu'à ${EUR.format(aid.loan_amount)}`);
  if (aid.recoverable_advance_amount != null) lines.push(`↩️ Avance récupérable : jusqu'à ${EUR.format(aid.recoverable_advance_amount)}`);

  const other = stripHtml(aid.other_financial_aid_comment);
  if (other) lines.push(`ℹ️ Autres aides : ${other}`);

  const body = stripHtml(aid.description);
  if (body) lines.push(body);

  const joined = lines.join("\n\n").trim();
  return joined.length ? joined.slice(0, 4000) : null;
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
    // Subventions AT = taux %, pas de montant € fixe → amount null.
    // Les montants réels (prêt, avance, plafonds) vivent dans la description.
    amount_min: null,
    amount_max: null,
    deadline: aid.submission_deadline ?? null,
    recurring: !!aid.recurrence && aid.recurrence !== "oneoff",
    application_url: aid.application_url ?? aid.origin_url ?? aid.url ?? null,
    required_documents: [],
    description: buildDescription(aid),
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
  | { ok: true; opportunities: ImportedOpportunity[]; apiTotal: number | null }
  | { ok: false; error: string };

/**
 * Récupère jusqu'à `maxAids` aides ouvertes depuis Aides-Territoires en
 * suivant TOUTE la pagination. Filtrées sur les structures associatives.
 * Défaut volontairement haut : on veut un catalogue exhaustif (le filtrage
 * fin se fait côté lieu via le profil + le score de pertinence).
 */
export async function fetchAidesTerritoires(maxAids = 2000): Promise<FetchResult> {
  const apiKey = process.env.AIDES_TERRITOIRES_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Clé API Aides-Territoires non configurée (AIDES_TERRITOIRES_API_KEY)." };
  }

  const bearer = await getBearer(apiKey);
  if (!bearer) {
    return { ok: false, error: "Authentification Aides-Territoires refusée — vérifiez la clé API." };
  }

  const collected: ImportedOpportunity[] = [];
  const seen = new Set<string>(); // anti-doublon inter-pages (même external_id)
  const base = `${AT_BASE}/api/aids/?targeted_audiences=association&order_by=submission_deadline`;
  let apiTotal: number | null = null;

  try {
    // Pagination par numéro de page explicite (DRF `?page=N`) — robuste : ne
    // dépend pas du champ `next`. On s'arrête sur page vide, 404 (au-delà de la
    // dernière page DRF renvoie 404) ou quand on a atteint maxAids.
    for (let pageNum = 1; collected.length < maxAids && pageNum <= 80; pageNum++) {
      const res: Response = await fetch(`${base}&page=${pageNum}`, {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      if (res.status === 404) break; // fin de pagination (DRF)
      if (!res.ok) {
        if (collected.length > 0) break; // garde ce qui est déjà collecté
        return { ok: false, error: `Aides-Territoires a répondu ${res.status}.` };
      }
      const body = (await res.json()) as { results?: AtAid[]; next?: string | null; count?: number };
      if (apiTotal === null && typeof body.count === "number") apiTotal = body.count;

      const results = body.results ?? [];
      if (results.length === 0) break; // plus rien à paginer

      for (const aid of results) {
        if (!aid?.id || !aid?.name) continue;
        const ext = String(aid.id);
        if (seen.has(ext)) continue;
        seen.add(ext);
        collected.push(mapAid(aid));
        if (collected.length >= maxAids) break;
      }
    }
  } catch {
    if (collected.length === 0) {
      return { ok: false, error: "Erreur réseau lors de l'appel à Aides-Territoires." };
    }
  }

  console.warn(`[aides-territoires] total API=${apiTotal ?? "?"} · collectées=${collected.length}`);
  return { ok: true, opportunities: collected, apiTotal };
}

export type SyncResult =
  | { ok: true; imported: number; updated: number; apiTotal: number | null }
  | { ok: false; error: string };

/**
 * Fetch + upsert dans grant_opportunities (logique partagée bouton admin /
 * cron). Anti-doublon par external_id : les nouvelles aides arrivent en
 * `published: false` (relecture super-admin avant publication), les
 * existantes voient leurs champs volatils rafraîchis sans toucher published.
 */
export async function syncAidesTerritoires(maxAids = 2000): Promise<SyncResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };

  const res = await fetchAidesTerritoires(maxAids);
  if (!res.ok) return { ok: false, error: res.error };
  const apiTotal = res.apiTotal;
  if (res.opportunities.length === 0) return { ok: true, imported: 0, updated: 0, apiTotal };

  const now = new Date().toISOString();

  // Quels external_id existent déjà ? (pour distinguer import vs rafraîchissement)
  const externalIds = res.opportunities.map((o) => o.external_id);
  const existingSet = new Set<string>();
  // `.in()` borné : on découpe par paquets de 300 pour ne pas faire une URL géante.
  for (let i = 0; i < externalIds.length; i += 300) {
    const slice = externalIds.slice(i, i + 300);
    const { data } = await admin
      .from("grant_opportunities")
      .select("external_id")
      .eq("source", "aides-territoires")
      .in("external_id", slice);
    for (const r of data ?? []) existingSet.add(r.external_id as string);
  }

  const newRows = res.opportunities.filter((o) => !existingSet.has(o.external_id));
  const updRows = res.opportunities.filter((o) => existingSet.has(o.external_id));

  let imported = 0;
  let updated = 0;

  // Nouveaux → insert par lot, non publiés (relecture super-admin).
  if (newRows.length) {
    const { error } = await admin.from("grant_opportunities").insert(
      newRows.map((o) => ({ ...o, source: "aides-territoires", published: false, updated_at: now })),
    );
    if (error) return { ok: false, error: error.message };
    imported = newRows.length;
  }

  // Existants → upsert par lot SANS `published` : ON CONFLICT DO UPDATE ne
  // touche que les colonnes fournies, donc le statut publié est préservé.
  if (updRows.length) {
    const { error } = await admin.from("grant_opportunities").upsert(
      updRows.map((o) => ({
        source: "aides-territoires" as const, external_id: o.external_id,
        title: o.title, funder: o.funder, funder_type: o.funder_type,
        themes: o.themes, regions: o.regions, structure_types: o.structure_types,
        amount_min: o.amount_min, amount_max: o.amount_max, deadline: o.deadline,
        recurring: o.recurring, application_url: o.application_url,
        required_documents: o.required_documents, description: o.description,
        updated_at: now,
      })),
      { onConflict: "source,external_id" },
    );
    if (error) return { ok: false, error: error.message };
    updated = updRows.length;
  }

  return { ok: true, imported, updated, apiTotal };
}
