"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import {
  isRoadmapStatus,
  type RoadmapEffort, type RoadmapPriority, type RoadmapStatus,
} from "@/lib/admin/roadmap-meta";

const PRIORITIES: RoadmapPriority[] = ["haute", "normale", "basse"];
const EFFORTS: RoadmapEffort[] = ["XS", "S", "M", "L", "XL"];

export interface RoadmapInput {
  title: string;
  description?: string | null;
  status?: RoadmapStatus;
  priority?: RoadmapPriority;
  effort?: RoadmapEffort | null;
  roadmap_ref?: string | null;
  due_date?: string | null;
}

/** Rejette ce que la contrainte CHECK refuserait, avec un message lisible. */
function validate(input: Partial<RoadmapInput>): string | null {
  if (input.title !== undefined && !input.title.trim()) return "Le titre est obligatoire.";
  if (input.status !== undefined && !isRoadmapStatus(input.status)) return "Colonne inconnue.";
  if (input.priority !== undefined && !PRIORITIES.includes(input.priority)) return "Priorité inconnue.";
  if (input.effort != null && !EFFORTS.includes(input.effort)) return "Ampleur inconnue.";
  return null;
}

export async function createRoadmapTask(input: RoadmapInput): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const bad = validate(input);
  if (bad) return { ok: false, error: bad };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const { error } = await admin.from("platform_tasks").insert({
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status ?? "a_trier",
    priority: input.priority ?? "normale",
    effort: input.effort ?? null,
    roadmap_ref: input.roadmap_ref?.trim() || null,
    due_date: input.due_date || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function updateRoadmapTask(
  id: string,
  patch: Partial<RoadmapInput>,
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const bad = validate(patch);
  if (bad) return { ok: false, error: bad };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  // On n'envoie que les champs réellement fournis : un `undefined` écraserait
  // la valeur existante par null côté PostgREST.
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.effort !== undefined) row.effort = patch.effort;
  if (patch.roadmap_ref !== undefined) row.roadmap_ref = patch.roadmap_ref?.trim() || null;
  if (patch.due_date !== undefined) row.due_date = patch.due_date || null;
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await admin.from("platform_tasks").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roadmap");
  return { ok: true };
}

/** Déplacement d'une carte d'une colonne à l'autre. */
export async function moveRoadmapTask(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!isRoadmapStatus(status)) return { ok: false, error: "Colonne inconnue." };
  return updateRoadmapTask(id, { status });
}

export async function deleteRoadmapTask(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const { error } = await admin.from("platform_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roadmap");
  return { ok: true };
}
