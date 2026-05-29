/**
 * Cartographie des 18 modules du dashboard (ref. ROUTES.md / HANDOFF).
 * `segment` correspond au sous-chemin /dashboard/[org]/<segment>.
 * `ready` = construit en v1 (sinon : structure prête, "à venir").
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
      { key: "dashboard", label: "Vue d'ensemble", segment: null, ready: true },
    ],
  },
  {
    title: "Activité",
    modules: [
      { key: "demandes", label: "Demandes", segment: "demandes", ready: false },
      { key: "personnes", label: "Personnes", segment: "personnes", ready: false },
      { key: "espaces", label: "Espaces", segment: "espaces", ready: false },
      { key: "reservations", label: "Réservations", segment: "reservations", ready: false },
      { key: "residences", label: "Résidences", segment: "residences", ready: false },
      { key: "evenements", label: "Événements", segment: "evenements", ready: false },
    ],
  },
  {
    title: "Gestion",
    modules: [
      { key: "finances", label: "Finances", segment: "finances", ready: false },
      { key: "documents", label: "Documents", segment: "documents", ready: false },
      { key: "partenaires", label: "Partenaires", segment: "partenaires", ready: false },
      { key: "taches", label: "Tâches & alertes", segment: "taches", ready: false },
    ],
  },
  {
    title: "Rayonnement",
    modules: [
      { key: "site-public", label: "Site public", segment: "site-public", ready: false },
      { key: "communication", label: "Communication", segment: "communication", ready: false },
      { key: "mediatheque", label: "Médiathèque", segment: "mediatheque", ready: false },
      { key: "impact", label: "Impact", segment: "impact", ready: false },
    ],
  },
  {
    title: "Collectif",
    modules: [
      { key: "gouvernance", label: "Gouvernance", segment: "gouvernance", ready: false },
      { key: "automatisations", label: "Automatisations", segment: "automatisations", ready: false },
    ],
  },
];

export const SETTINGS_MODULE: ModuleDef = {
  key: "parametres",
  label: "Paramètres",
  segment: "parametres",
  ready: false,
};
