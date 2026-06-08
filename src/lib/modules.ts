/**
 * Cartographie des modules du dashboard — modules progressifs (F4 UX audit).
 *
 * `layer` :
 *   0 = Socle (toujours actif, non désactivable)
 *   1 = Activités (activées à la création via profil du lieu)
 *   2 = Avancé (révélé progressivement par les données)
 *
 * `segment` correspond au sous-chemin /dashboard/[org]/<segment>.
 * `tableKey` sert à la migration automatique (≥1 ligne → enabled).
 */

export type OrgTier = "free" | "complete" | "multilieu";

export interface ModuleDef {
  key: string;
  label: string;
  segment: string | null;
  layer: 0 | 1 | 2;
  description?: string;
  tableKey?: string;       // nom de la table Supabase pour détection auto
  minTier?: OrgTier;       // tier minimum requis (undefined = free)
}

export interface ModuleSection {
  title: string;
  modules: ModuleDef[];
}

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    title: "Pilotage",
    modules: [
      { key: "dashboard",  label: "Tableau de bord", segment: null,         layer: 0 },
      { key: "demandes",   label: "Demandes",         segment: "demandes",   layer: 0, description: "Le pont entre votre site public et votre équipe." },
      { key: "personnes",  label: "Personnes",        segment: "personnes",  layer: 0, description: "Votre CRM : membres, bénévoles, partenaires." },
      { key: "taches",     label: "Tâches & alertes", segment: "taches",     layer: 1, tableKey: "tasks", description: "Suivi des actions et alertes prioritaires.", minTier: "complete" },
    ],
  },
  {
    title: "Gestion du lieu",
    modules: [
      { key: "communaute",   label: "Communauté",    segment: "communaute",   layer: 1, tableKey: "announcements", description: "Annonces et vie collective.",                          minTier: "complete" },
      { key: "espaces",      label: "Espaces",       segment: "espaces",      layer: 1, tableKey: "spaces",         description: "Catalogue des salles et ateliers réservables.",       minTier: "complete" },
      { key: "reservations", label: "Réservations",  segment: "reservations", layer: 1, tableKey: "reservations",   description: "Planification et suivi des créneaux.",                minTier: "complete" },
      { key: "residences",   label: "Résidences",    segment: "residences",   layer: 1, tableKey: "residences",     description: "Accueil d'artistes et de projets.",                   minTier: "complete" },
      { key: "artistes",     label: "Artistes",      segment: "artistes",     layer: 1, tableKey: "artists",        description: "Profils et portfolios des artistes accueillis.",      minTier: "complete" },
      { key: "evenements",   label: "Événements",    segment: "evenements",   layer: 1, tableKey: "events",         description: "Ateliers, concerts, AG — visibles sur votre site." },
    ],
  },
  {
    title: "Structure",
    modules: [
      { key: "adhesions",   label: "Adhésions",       segment: "adhesions",   layer: 1, tableKey: "membership_campaigns", description: "Campagnes et tunnel d'adhésion en ligne." },
      { key: "finances",    label: "Finances",         segment: "finances",    layer: 1, tableKey: "transactions",          description: "Transactions, solde, export comptable.",  minTier: "complete" },
      { key: "factures",    label: "Facturation",      segment: "factures",    layer: 1, tableKey: "invoices",               description: "Factures, avoirs, coworking.",            minTier: "complete" },
      { key: "depenses",    label: "Dépenses",         segment: "depenses",    layer: 1, tableKey: "expenses",               description: "Charges et justificatifs par pôle.",      minTier: "complete" },
      { key: "subventions", label: "Subventions",      segment: "subventions", layer: 2, tableKey: "grants",                 description: "Suivi des demandes et conventions.",      minTier: "complete" },
      { key: "caisse",      label: "Caisse certifiée", segment: "caisse",      layer: 2, tableKey: "cash_entries",           description: "Encaissements conformes NF525.",          minTier: "complete" },
      { key: "documents",   label: "Documents",        segment: "documents",   layer: 1, tableKey: "documents",              description: "Stockage et signatures en ligne.",         minTier: "complete" },
      { key: "gouvernance", label: "Gouvernance",      segment: "gouvernance", layer: 2, tableKey: "governance_meetings",    description: "CA, AG, mandats, votes.",                 minTier: "complete" },
      { key: "impact",      label: "Impact",           segment: "impact",      layer: 2, tableKey: "impact_indicators",      description: "Indicateurs et tableaux de bord.",        minTier: "complete" },
      { key: "partenaires", label: "Partenaires",      segment: "partenaires", layer: 2, tableKey: "partners",               description: "Réseau et conventions partenaires.",      minTier: "complete" },
    ],
  },
  {
    title: "Publication",
    modules: [
      { key: "site-public",   label: "Site public",   segment: "site-public",   layer: 0, description: "Votre vitrine publique." },
      { key: "communication", label: "Communication", segment: "communication", layer: 1, tableKey: "newsletters",  description: "Newsletter et bulletins de l'équipe.", minTier: "complete" },
      { key: "mediatheque",   label: "Médiathèque",   segment: "mediatheque",   layer: 1, tableKey: "media_files", description: "Photos, vidéos, ressources.",          minTier: "complete" },
    ],
  },
  {
    title: "Système",
    modules: [
      { key: "automatisations", label: "Automatisations", segment: "automatisations", layer: 2, description: "Règles et déclencheurs automatiques.", minTier: "complete" },
      { key: "equipe",          label: "Équipe",           segment: "equipe",          layer: 0, description: "Membres de l'équipe et accès." },
      { key: "parametres",      label: "Paramètres",       segment: "parametres",      layer: 0, description: "Configuration de votre lieu." },
    ],
  },
];

/** Clés des modules socle (couche 0) — toujours visibles. */
export const SOCLE_KEYS = new Set<string>(
  MODULE_SECTIONS.flatMap((s) => s.modules.filter((m) => m.layer === 0).map((m) => m.key))
);

/** Archétypes de lieu — sélection à l'inscription pour pré-activer les bons modules. */
export interface OrgArchetype {
  key: string;
  emoji: string;
  label: string;
  description: string;
  modules: string[]; // couche 1+2 à activer (le socle est toujours là)
}

export const ORG_ARCHETYPES: OrgArchetype[] = [
  {
    key: "tiers-lieu",
    emoji: "🏠",
    label: "Tiers-lieu / lieu hybride",
    description: "Espace de vie collective, polyvalent, ouvert au quartier.",
    modules: ["espaces", "reservations", "evenements", "adhesions", "communaute", "taches"],
  },
  {
    key: "coworking",
    emoji: "💻",
    label: "Espace de coworking",
    description: "Location de bureaux, postes nomades, salles de réunion.",
    modules: ["espaces", "reservations", "factures", "finances", "taches"],
  },
  {
    key: "culturel",
    emoji: "🎭",
    label: "Lieu culturel / MJC",
    description: "Programmation artistique, ateliers, animations de quartier.",
    modules: ["evenements", "adhesions", "communaute", "communication", "taches"],
  },
  {
    key: "residence",
    emoji: "🎨",
    label: "Résidence / fabrique artistique",
    description: "Accueil d'artistes en résidence, studios, espaces de création.",
    modules: ["residences", "artistes", "espaces", "evenements", "taches"],
  },
  {
    key: "association",
    emoji: "🤝",
    label: "Association (sans lieu fixe)",
    description: "Gestion de membres, adhésions, finances et communication.",
    modules: ["adhesions", "communaute", "finances", "communication", "taches"],
  },
  {
    key: "autre",
    emoji: "➕",
    label: "Autre",
    description: "Je définirai mes besoins après l'inscription.",
    modules: ["adhesions", "communaute", "evenements"],
  },
];

/** Libellé de page d'après le segment d'URL (pour le titre de la topbar). */
export function moduleLabelForSegment(segment: string | null): string {
  if (!segment) return "Tableau de bord";
  for (const section of MODULE_SECTIONS) {
    const found = section.modules.find((m) => m.segment === segment);
    if (found) return found.label;
  }
  if (segment === "modules") return "Modules";
  return "Tableau de bord";
}
