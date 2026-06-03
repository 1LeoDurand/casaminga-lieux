/** Types Subventions v2 — Veille. Purs (importables client + serveur). */

export type FunderType = "etat" | "region" | "departement" | "europe" | "fondation" | "autre";

export interface GrantOpportunity {
  id: string;
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
  source: "manuel" | "aides-territoires";
  external_id: string | null;
  published: boolean;
}

export interface OrgGrantProfile {
  organization_id: string;
  region: string | null;
  structure_type: string | null;
  themes: string[];
  annual_budget: number | null;
  project_summary: string | null;
}

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

/**
 * Score d'éligibilité 0–100 d'une opportunité pour un profil donné.
 * Régions/structures vides = ouvert à tous (compatible). Thèmes communs = bonus.
 */
export function eligibilityScore(opp: GrantOpportunity, profile: OrgGrantProfile | null): number {
  if (!profile) return 50; // pas de profil → neutre
  let score = 0;
  let max = 0;

  // Région (poids 35)
  max += 35;
  if (opp.regions.length === 0) score += 35;
  else if (profile.region && opp.regions.includes(profile.region)) score += 35;

  // Type de structure (poids 25)
  max += 25;
  if (opp.structure_types.length === 0) score += 25;
  else if (profile.structure_type && opp.structure_types.includes(profile.structure_type)) score += 25;

  // Thématiques (poids 40)
  max += 40;
  if (opp.themes.length === 0) score += 20;
  else {
    const common = opp.themes.filter((t) => profile.themes.includes(t)).length;
    if (common > 0) score += Math.min(40, 20 + common * 10);
  }

  return Math.round((score / max) * 100);
}
