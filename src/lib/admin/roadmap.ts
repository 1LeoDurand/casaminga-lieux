import "server-only";
import { createAdminClient } from "./guard";
import type { RoadmapPlatform, RoadmapPriority, RoadmapTask } from "./roadmap-meta";

/**
 * Lecture de la feuille de route. La table a la RLS activée SANS aucune
 * politique : elle n'est donc visible que par `service_role`, qui contourne la
 * RLS. D'où le passage obligé par createAdminClient(), toujours après
 * requireSuperAdmin(). Aucune organisation ne peut l'apercevoir.
 */

const SELECT = "id, title, description, status, priority, effort, roadmap_ref, due_date, platform, kind, created_at, updated_at";

/** Priorité haute d'abord, puis échéance la plus proche, puis les plus récentes. */
const PRIORITY_RANK: Record<RoadmapPriority, number> = { haute: 0, normale: 1, basse: 2 };

/**
 * Cartes de la feuille de route, filtrées par plateforme quand `platform` est
 * fourni (contexte de travail, prompt 6). Omis, renvoie tout : c'est le cas
 * "Toutes les plateformes".
 */
export async function getRoadmapTasks(platform?: RoadmapPlatform): Promise<RoadmapTask[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  let query = admin.from("platform_tasks").select(SELECT);
  if (platform) query = query.eq("platform", platform);
  const { data, error } = await query;
  if (error || !data) return [];

  return (data as RoadmapTask[]).sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    // Sans échéance = en dernier, plutôt qu'en tête comme le ferait une
    // comparaison naïve de chaînes avec null.
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.created_at < b.created_at ? -1 : 1;
  });
}
