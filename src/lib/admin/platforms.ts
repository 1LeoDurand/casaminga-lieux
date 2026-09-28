/**
 * Plateformes de l'écosystème Casa Minga, vues depuis /admin — source unique
 * du libellé, du domaine et de la couleur de chacune.
 *
 * Réutilise `RoadmapPlatform` (roadmap-meta.ts, migration 0015_platform)
 * plutôt que d'introduire un second type : une plateforme de la feuille de
 * route et une plateforme de contexte de travail sont la même chose. `AdminPlatform`
 * n'ajoute qu'une valeur, "all", pour l'entrée "Toutes les plateformes".
 *
 * Ce fichier ne doit JAMAIS importer `next/headers` ni toucher à Supabase :
 * il est lu aussi bien par des composants client (le sélecteur, le liseré)
 * que par des pages serveur. La lecture du contexte (cookie, query) vit dans
 * `platform-context.ts`, qui lui est réservé au serveur.
 */

import { ROADMAP_PLATFORMS, type RoadmapPlatform } from "./roadmap-meta";

// Contexte de travail admin : une plateforme précise, ou "all" (toutes).
export type AdminPlatform = RoadmapPlatform | "all";

export interface AdminPlatformMeta {
  id: AdminPlatform;
  label: string;
  domain: string | null;
  // Couleur d'accent (liseré, sélecteur), en dehors de la palette déjà prise :
  // le coral (#ff8a65) marque déjà l'admin en général (nav active, marque),
  // et les statuts de la feuille de route utilisent gris/ambre/bleu/violet/vert
  // (roadmap-meta.ts) — trois teintes distinctes de tout ça, lisibles sur fond
  // clair (cream/blanc) et sur le fond sombre de la barre latérale.
  color: string;
}

export const ADMIN_PLATFORMS: AdminPlatformMeta[] = [
  { id: "admin", label: "Admin", domain: "admin.casaminga.com", color: "#0f766e" }, // teal-700
  { id: "public", label: "Portail", domain: "casaminga.com", color: "#be185d" }, // pink-700
  { id: "sejour", label: "Séjours", domain: "sejour.casaminga.com", color: "#4338ca" }, // indigo-700
  { id: "all", label: "Toutes les plateformes", domain: null, color: "#6b7280" }, // gray-500, neutre, jamais le défaut
];

const ADMIN_PLATFORM_VALUES = ADMIN_PLATFORMS.map((p) => p.id);

export function isAdminPlatform(v: string | null | undefined): v is AdminPlatform {
  if (!v) return false;
  return (ADMIN_PLATFORM_VALUES as string[]).includes(v);
}

export function getAdminPlatformMeta(id: AdminPlatform): AdminPlatformMeta {
  return ADMIN_PLATFORMS.find((p) => p.id === id) ?? ADMIN_PLATFORMS[0];
}

// Garde-fou à la compilation : chaque plateforme de la feuille de route doit
// avoir son entrée ici (sans quoi le sélecteur en oublierait une en silence).
const _coverage: Record<RoadmapPlatform, true> = ROADMAP_PLATFORMS.reduce(
  (acc, p) => ({ ...acc, [p.value]: true as const }),
  {} as Record<RoadmapPlatform, true>,
);
void _coverage;
