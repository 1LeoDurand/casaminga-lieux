/**
 * Composition du tableau de bord selon l'archétype du lieu (F-Dashboard adaptatif).
 *
 * Trois couches :
 *   1. Socle — toujours présent (Aujourd'hui, demandes récentes).
 *   2. Archétype — `organizations.org_type` décide quels KPIs montent en rangée
 *      héros et dans quel ordre.
 *   3. Modules — chaque module activé apporte son bloc (gouvernance → prochaine
 *      instance, adhesions → campagne, residences → séjours, subventions → échéances).
 *
 * Le registre est de la donnée pure : la page dashboard calcule les valeurs et
 * pioche ici l'ordre / la sélection.
 */

export type ArchetypeKey =
  | "tiers-lieu"
  | "coworking"
  | "culturel"
  | "residence"
  | "association"
  | "autre";

const ARCHETYPE_KEYS: ArchetypeKey[] = [
  "tiers-lieu", "coworking", "culturel", "residence", "association", "autre",
];

/** org_type brut (nullable, legacy) → archétype valide. */
export function normalizeArchetype(raw: string | null | undefined): ArchetypeKey {
  return ARCHETYPE_KEYS.includes(raw as ArchetypeKey) ? (raw as ArchetypeKey) : "autre";
}

// ── Rangée héros : 6 KPIs ordonnés par archétype ─────────────────────────────
// Les clés référencent les KPIs calculés dans la page dashboard.
export type KpiKey =
  | "revenus_mois"
  | "solde"
  | "impayes"
  | "membres_actifs"
  | "demandes"
  | "evenements_avenir"
  | "evenements_semaine"
  | "espaces"
  | "resas_jour"
  | "occupation_semaine"
  | "adherents_a_jour"
  | "renouvellements_30j"
  | "cotisations_mois"
  | "residences_en_cours"
  | "candidatures_residences"
  | "restitutions_avenir"
  | "taches_urgentes";

export const HERO_KPIS: Record<ArchetypeKey, KpiKey[]> = {
  "tiers-lieu": ["resas_jour", "occupation_semaine", "membres_actifs", "demandes", "evenements_avenir", "revenus_mois"],
  coworking:    ["occupation_semaine", "revenus_mois", "impayes", "resas_jour", "espaces", "solde"],
  culturel:     ["evenements_semaine", "evenements_avenir", "adherents_a_jour", "renouvellements_30j", "demandes", "revenus_mois"],
  residence:    ["residences_en_cours", "candidatures_residences", "restitutions_avenir", "espaces", "demandes", "taches_urgentes"],
  association:  ["adherents_a_jour", "cotisations_mois", "solde", "renouvellements_30j", "demandes", "evenements_avenir"],
  autre:        ["revenus_mois", "espaces", "membres_actifs", "demandes", "evenements_avenir", "solde"],
};

// ── Blocs modules : poids par archétype (0 = masqué) ─────────────────────────
// Un bloc s'affiche si son module est activé ET que son poids > 0 pour
// l'archétype. Tri par poids décroissant.
export type ModuleBlockKey = "gouvernance" | "adhesions" | "residences" | "subventions";

export const MODULE_BLOCKS: Record<ModuleBlockKey, { module: string; weight: Record<ArchetypeKey, number> }> = {
  gouvernance: {
    module: "gouvernance",
    weight: { "tiers-lieu": 2, coworking: 0, culturel: 2, residence: 1, association: 4, autre: 1 },
  },
  adhesions: {
    module: "adhesions",
    weight: { "tiers-lieu": 3, coworking: 1, culturel: 4, residence: 0, association: 5, autre: 2 },
  },
  residences: {
    module: "residences",
    weight: { "tiers-lieu": 1, coworking: 0, culturel: 1, residence: 5, association: 0, autre: 1 },
  },
  subventions: {
    module: "subventions",
    weight: { "tiers-lieu": 2, coworking: 0, culturel: 3, residence: 3, association: 2, autre: 1 },
  },
};

/** Blocs à afficher pour cet archétype, triés par pertinence. */
export function pickModuleBlocks(
  archetype: ArchetypeKey,
  enabledModules: Set<string>,
): ModuleBlockKey[] {
  return (Object.keys(MODULE_BLOCKS) as ModuleBlockKey[])
    .filter((k) => enabledModules.has(MODULE_BLOCKS[k].module) && MODULE_BLOCKS[k].weight[archetype] > 0)
    .sort((a, b) => MODULE_BLOCKS[b].weight[archetype] - MODULE_BLOCKS[a].weight[archetype]);
}

// ── Bloc fantôme : suggestion du prochain module pertinent ───────────────────
export interface ModuleSuggestion {
  module: string;
  title: string;
  description: string;
}

const GHOST_SUGGESTIONS: Record<ArchetypeKey, ModuleSuggestion[]> = {
  "tiers-lieu": [
    { module: "caisse", title: "Encaissez au comptoir", description: "Bar, billetterie, boutique — caisse certifiée NF525 avec tickets PDF." },
    { module: "gouvernance", title: "Préparez votre prochaine AG", description: "Convocations par email, émargement, pouvoirs et PV en PDF." },
  ],
  coworking: [
    { module: "documents", title: "Faites signer vos contrats en ligne", description: "Envoyez un lien de signature : vos coworkers signent depuis leur boîte mail." },
    { module: "depenses", title: "Suivez vos charges", description: "Loyer, fournitures, services — dépenses classées par pôle avec justificatifs." },
  ],
  culturel: [
    { module: "communication", title: "Tenez vos adhérents informés", description: "Newsletters et bulletins envoyés directement depuis votre CRM." },
    { module: "subventions", title: "Pilotez vos subventions", description: "Échéances de reporting, tranches attendues, conventions — rien ne se perd." },
  ],
  residence: [
    { module: "documents", title: "Conventions signées en ligne", description: "Envoyez les conventions de résidence à signer par email, sans impression." },
    { module: "subventions", title: "Pilotez vos subventions", description: "DRAC, région, fondations — échéances et tranches suivies au même endroit." },
  ],
  association: [
    { module: "gouvernance", title: "Préparez votre prochaine AG", description: "Convocations par email, émargement, pouvoirs, résolutions et PV en PDF." },
    { module: "finances", title: "Suivez votre trésorerie", description: "Recettes, dépenses, solde — export comptable en un clic." },
  ],
  autre: [
    { module: "adhesions", title: "Ouvrez les adhésions en ligne", description: "Campagne, formules, tunnel public — vos membres adhèrent depuis votre site." },
  ],
};

/** Première suggestion dont le module n'est pas encore activé (ou null). */
export function pickSuggestion(
  archetype: ArchetypeKey,
  enabledModules: Set<string>,
): ModuleSuggestion | null {
  return GHOST_SUGGESTIONS[archetype].find((s) => !enabledModules.has(s.module)) ?? null;
}

// ── Checklist « Premiers pas » par archétype ─────────────────────────────────
// Les flags `done` sont calculés dans la page ; ici on définit quoi montrer.
export type OnboardingStepKey =
  | "members" | "campaign" | "event" | "space" | "residence_first" | "helloasso";

export interface OnboardingStepDef {
  key: OnboardingStepKey;
  label: string;
  description: string;
  segment: string;
}

const STEP_CATALOG: Record<OnboardingStepKey, OnboardingStepDef> = {
  members:         { key: "members",         label: "Ajouter vos premiers membres",        description: "Constituez votre base de membres et contacts", segment: "personnes" },
  campaign:        { key: "campaign",        label: "Créer une campagne d'adhésion",       description: "Permettez à vos membres d'adhérer en ligne", segment: "adhesions" },
  event:           { key: "event",           label: "Programmer un événement",             description: "Atelier, concert, AG — visible sur votre site public", segment: "evenements" },
  space:           { key: "space",           label: "Déclarer un espace réservable",       description: "Salle, atelier, bureau partagé", segment: "espaces" },
  residence_first: { key: "residence_first", label: "Enregistrer une première résidence",  description: "Artiste accueilli, dates de séjour, studio", segment: "residences" },
  helloasso:       { key: "helloasso",       label: "Connecter HelloAsso (optionnel)",     description: "Synchronisez automatiquement vos adhésions", segment: "parametres" },
};

const ONBOARDING_BY_ARCHETYPE: Record<ArchetypeKey, OnboardingStepKey[]> = {
  "tiers-lieu": ["members", "space", "event", "campaign", "helloasso"],
  coworking:    ["space", "members", "event", "helloasso"],
  culturel:     ["event", "members", "campaign", "helloasso"],
  residence:    ["residence_first", "space", "members", "event"],
  association:  ["members", "campaign", "event", "helloasso"],
  autre:        ["members", "campaign", "event", "space", "helloasso"],
};

/** Étapes onboarding pour cet archétype (définitions, sans flags done). */
export function onboardingStepsFor(archetype: ArchetypeKey): OnboardingStepDef[] {
  return ONBOARDING_BY_ARCHETYPE[archetype].map((k) => STEP_CATALOG[k]);
}
