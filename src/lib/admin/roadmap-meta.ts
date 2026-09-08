/**
 * Feuille de route de la plateforme — types et libellés.
 *
 * Ce fichier est importé par un composant client : il ne doit JAMAIS porter
 * `import "server-only"` ni toucher à Supabase — le build casse sinon, ce qui
 * est arrivé au premier jet. La lecture en base vit dans `roadmap.ts`, qui lui
 * est marqué server-only.
 */

export type RoadmapStatus = "a_trier" | "valide" | "en_cours" | "a_deployer" | "fait";
export type RoadmapPriority = "haute" | "normale" | "basse";
export type RoadmapEffort = "XS" | "S" | "M" | "L" | "XL";

export interface RoadmapTask {
  id: string;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  effort: RoadmapEffort | null;
  roadmap_ref: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export const ROADMAP_STATUSES: { value: RoadmapStatus; label: string; dot: string; hint: string }[] = [
  { value: "a_trier",    label: "À trier",     dot: "#8a8a8a", hint: "Proposé, pas encore tranché" },
  { value: "valide",     label: "Validé",      dot: "#a06800", hint: "Feu vert, à faire" },
  { value: "en_cours",   label: "En cours",    dot: "#1d4ed8", hint: "En construction" },
  { value: "a_deployer", label: "À déployer",  dot: "#7c3aed", hint: "Codé, pas encore en production" },
  { value: "fait",       label: "Fait",        dot: "#2f8a4c", hint: "Livré et vérifié" },
];

const STATUS_VALUES = ROADMAP_STATUSES.map((s) => s.value);
export function isRoadmapStatus(v: string): v is RoadmapStatus {
  return (STATUS_VALUES as string[]).includes(v);
}
