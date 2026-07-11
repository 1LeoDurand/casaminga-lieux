/** Types Subventions v2 — Veille. Purs (importables client + serveur). */

export type FunderType = "etat" | "region" | "departement" | "europe" | "fondation" | "autre";

// ── Assistance rédaction IA (Lot 12 P4) ─────────────────────
export type DraftSection = "presentation" | "projet" | "adequation";

export const DRAFT_SECTIONS: Record<DraftSection, { label: string; hint: string }> = {
  presentation: {
    label: "Présentation de la structure",
    hint: "Qui vous êtes, votre histoire, vos activités, votre ancrage territorial.",
  },
  projet: {
    label: "Description du projet",
    hint: "Le projet financé : objectifs, publics, actions, calendrier.",
  },
  adequation: {
    label: "Adéquation au dispositif",
    hint: "Pourquoi votre projet répond aux critères de cet appel précis.",
  },
};

export interface GrantOpportunity {
  id: string;
  title: string;
  funder: string | null;
  funder_type: FunderType | null;
  /** Libellés de catégories Aides-Territoires (ex. "Nature / environnement / Biodiversité"). */
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
  source: "manuel" | "aides-territoires";
  external_id: string | null;
  published: boolean;
  // ── Enrichissement AT optionnel (Layer 2 : migration 0008 + réimport). ──
  // Absents/vides tant que la couche d'enrichissement n'est pas appliquée :
  // toujours lus avec fallback, jamais requis au runtime.
  /** Nature d'aide : "grant" (subvention), "loan", "recoverable-advance", ingénierie… */
  aid_type_slugs?: string[];
  /** L'aide est-elle payante pour le bénéficiaire ? */
  is_charged?: boolean | null;
  /** Code région INSEE du périmètre (ex. "11" = Île-de-France). */
  region_code?: string | null;
  /** Échelle du périmètre : commune / epci / department / region / country / europe. */
  perimeter_scale?: string | null;
  /** Critères d'éligibilité (texte AT aplati). */
  eligibility?: string | null;
  /** Avancement du projet visé : réflexion, opérationnel… (libellés AT). */
  aid_steps?: string[];
  /** Actions concernées : fonctionnement (supply) / investissement (investment). */
  aid_destinations?: string[];
  /** Ouverture des candidatures. */
  date_start?: string | null;
  /** Appel à projets / manifestation d'intérêt. */
  is_call_for_project?: boolean | null;
  /** Contact du porteur (texte AT aplati). */
  contact?: string | null;
  /** Exemples de projets financés (texte AT aplati). */
  project_examples?: string | null;
  /** Slug AT → permalien https://aides-territoires.beta.gouv.fr/aides/<slug>/ */
  at_slug?: string | null;
}

export interface OrgGrantProfile {
  organization_id: string;
  region: string | null;
  structure_type: string | null;
  /**
   * Catégories Aides-Territoires sélectionnées par le lieu, en LIBELLÉS COMPLETS
   * (mêmes chaînes que `GrantOpportunity.themes`). Stockées dans la colonne
   * `org_grant_profile.themes` — le matching thématique est une intersection
   * exacte avec les catégories des aides. Voir lib/grants/taxonomy.ts.
   */
  themes: string[];
  annual_budget: number | null;
  project_summary: string | null;
}

export type ApplicationStatus = "interesse" | "en_cours" | "depose" | "obtenu" | "refuse";

export interface GrantApplication {
  id: string;
  organization_id: string;
  opportunity_id: string;
  status: ApplicationStatus;
  notes: string | null;
  amount_requested: number | null;
  applied_at: string | null;
  result_at: string | null;
  linked_grant_id: string | null;
  created_at: string;
  updated_at: string;
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; color: string; icon: string }> = {
  interesse: { label: "Intéressé",      color: "bg-blue-50 text-blue-700 border-blue-200",      icon: "👀" },
  en_cours:  { label: "Dossier en cours", color: "bg-amber-50 text-amber-700 border-amber-200",   icon: "✏️" },
  depose:    { label: "Déposé",          color: "bg-violet-50 text-violet-700 border-violet-200", icon: "📤" },
  obtenu:    { label: "Obtenu ✓",        color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🎉" },
  refuse:    { label: "Refusé",          color: "bg-red-50 text-red-600 border-red-200",          icon: "✕" },
};

export const FUNDER_TYPE_LABELS: Record<FunderType, string> = {
  etat: "État",
  region: "Région",
  departement: "Département",
  europe: "Europe",
  fondation: "Fondation",
  autre: "Autre",
};

export const GRANT_THEMES = [
  "Culture", "ESS", "Transition écologique", "Numérique", "Jeunesse",
  "Cohésion sociale", "Économie locale", "Patrimoine", "Éducation populaire",
] as const;

export const FRENCH_REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire",
  "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie",
  "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  "Outre-mer",
] as const;

import { parentThemes, isNationalPerimeter, perimeterMatchesRegions } from "./taxonomy";

/**
 * Contexte géographique du lieu pour le scoring : toutes les régions couvertes
 * par l'organisation (région du profil + régions dérivées de ses établissements
 * — gestion multi-lieu). Vide = localisation inconnue → axe géo neutralisé.
 */
export type OrgGeoContext = string[];

/**
 * Score de pertinence 0–100 d'une opportunité pour un profil de lieu.
 *
 * Trois axes (l'axe « type de structure » a été retiré : toutes les aides
 * importées ciblent déjà les associations, il n'apportait aucune discrimination
 * et gonflait tous les scores à ~60 %) :
 *   • Thématique (55 pts) — intersection exacte des catégories AT, avec repli
 *     sur le thème parent commun. C'est le signal le plus fort.
 *   • Géographique (35 pts) — aide nationale/européenne = compatible partout ;
 *     sinon match sur l'une des régions du lieu (profil + établissements).
 *   • Fraîcheur / récurrence (10 pts) — petit bonus deadline proche ou récurrent.
 *
 * `orgRegions` : union des régions du lieu (voir OrgGeoContext). Optionnel pour
 * compat ascendante ; sans lui, seule la région du profil est prise en compte.
 */
export function eligibilityScore(
  opp: GrantOpportunity,
  profile: OrgGrantProfile | null,
  orgRegions: OrgGeoContext = [],
): number {
  if (!profile) return 50; // pas de profil → neutre

  // Régions du lieu : profil + établissements, dédupliquées.
  const regions = [...new Set([profile.region, ...orgRegions].filter((r): r is string => !!r))];

  let score = 0;

  // ── Thématique (55 pts) ─────────────────────────────────────
  if (profile.themes.length === 0) {
    score += 22; // profil sans thématique → neutre bas
  } else if (opp.themes.length === 0) {
    score += 18; // aide généraliste (toutes thématiques)
  } else {
    const profileSet = new Set(profile.themes);
    const exact = opp.themes.filter((t) => profileSet.has(t)).length;
    if (exact >= 1) {
      score += Math.min(55, 45 + (exact - 1) * 5); // 1 match = 45, +5 par match, plafonné
    } else {
      // Pas de catégorie exacte commune → thème parent commun ?
      const oppParents = parentThemes(opp.themes);
      const profParents = parentThemes(profile.themes);
      const sharedParent = [...oppParents].some((p) => profParents.has(p));
      score += sharedParent ? 28 : 0;
    }
  }

  // ── Géographique (35 pts) ───────────────────────────────────
  if (regions.length === 0) {
    score += 18; // localisation inconnue → neutre
  } else if (opp.region_code || opp.perimeter_scale === "country" || opp.perimeter_scale === "europe") {
    // Layer 2 : périmètre précis disponible.
    if (opp.perimeter_scale === "country" || opp.perimeter_scale === "europe") score += 35;
    else score += regionMatchesCode(opp, regions) ? 35 : 6;
  } else if (opp.regions.length === 0 || opp.regions.some(isNationalPerimeter)) {
    score += 35; // périmètre vide ou national/européen → compatible partout
  } else if (opp.regions.some((p) => perimeterMatchesRegions(p, regions))) {
    score += 35;
  } else {
    score += 6; // périmètre régional/local qui ne recouvre pas le lieu
  }

  // ── Fraîcheur / récurrence (10 pts) ─────────────────────────
  if (opp.deadline) {
    const days = (new Date(opp.deadline).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 90) score += 10;
    else if (days > 90) score += 6;
    else score += 0; // échue
  } else if (opp.recurring) {
    score += 8; // permanente/récurrente
  } else {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Layer 2 : match région via le code INSEE (mapping libellé région → code). */
function regionMatchesCode(opp: GrantOpportunity, orgRegions: string[]): boolean {
  if (!opp.region_code) return false;
  return orgRegions.some((r) => REGION_NAME_TO_CODE[r] === opp.region_code);
}

/** Libellé région (FRENCH_REGIONS) → code INSEE région. "Outre-mer" regroupe plusieurs codes → non mappé (fallback libellé). */
export const REGION_NAME_TO_CODE: Record<string, string> = {
  "Auvergne-Rhône-Alpes": "84",
  "Bourgogne-Franche-Comté": "27",
  "Bretagne": "53",
  "Centre-Val de Loire": "24",
  "Corse": "94",
  "Grand Est": "44",
  "Hauts-de-France": "32",
  "Île-de-France": "11",
  "Normandie": "28",
  "Nouvelle-Aquitaine": "75",
  "Occitanie": "76",
  "Pays de la Loire": "52",
  "Provence-Alpes-Côte d'Azur": "93",
};
