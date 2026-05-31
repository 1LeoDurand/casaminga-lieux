/**
 * Cartographie des modules du dashboard, fidèle au prototype Claude Design
 * (Plateforme.html). Groupement de la nav latérale :
 *   Pilotage · Gestion du lieu · Structure · Publication · Système.
 *
 * `segment` correspond au sous-chemin /dashboard/[org]/<segment>.
 * `ready`   = module réellement construit (sinon : à venir).
 */

export interface ModuleDef {
  key: string;
  label: string;
  segment: string | null; // null = vue d'ensemble (racine du dashboard)
  ready: boolean;
}

export interface ModuleSection {
  title: string;
  modules: ModuleDef[];
}

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    title: "Pilotage",
    modules: [
      { key: "dashboard", label: "Tableau de bord", segment: null, ready: true },
      { key: "demandes", label: "Demandes", segment: "demandes", ready: true },
      { key: "personnes", label: "Personnes", segment: "personnes", ready: true },
      { key: "taches", label: "Tâches & alertes", segment: "taches", ready: true },
    ],
  },
  {
    title: "Gestion du lieu",
    modules: [
      { key: "communaute", label: "Communauté", segment: "communaute", ready: true },
      { key: "espaces", label: "Espaces", segment: "espaces", ready: true },
      { key: "reservations", label: "Réservations", segment: "reservations", ready: true },
      { key: "residences", label: "Résidences", segment: "residences", ready: true },
      { key: "evenements", label: "Événements", segment: "evenements", ready: true },
    ],
  },
  {
    title: "Structure",
    modules: [
      { key: "finances", label: "Finances", segment: "finances", ready: true },
      { key: "documents", label: "Documents", segment: "documents", ready: true },
      { key: "gouvernance", label: "Gouvernance", segment: "gouvernance", ready: true },
      { key: "impact", label: "Impact", segment: "impact", ready: false },
      { key: "partenaires", label: "Partenaires", segment: "partenaires", ready: false },
    ],
  },
  {
    title: "Publication",
    modules: [
      { key: "site-public", label: "Site public", segment: "site-public", ready: true },
      { key: "communication", label: "Communication", segment: "communication", ready: true },
      { key: "mediatheque", label: "Médiathèque", segment: "mediatheque", ready: true },
    ],
  },
  {
    title: "Système",
    modules: [
      { key: "automatisations", label: "Automatisations", segment: "automatisations", ready: false },
      { key: "parametres", label: "Paramètres", segment: "parametres", ready: true },
    ],
  },
];

/** Libellé de page d'après le segment d'URL (pour le titre de la topbar). */
export function moduleLabelForSegment(segment: string | null): string {
  if (!segment) return "Tableau de bord";
  for (const section of MODULE_SECTIONS) {
    const found = section.modules.find((m) => m.segment === segment);
    if (found) return found.label;
  }
  return "Tableau de bord";
}
