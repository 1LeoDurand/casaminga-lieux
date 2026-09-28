"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { isAdminPlatform } from "@/lib/admin/platforms";

export type FeedbackStatus = "open" | "accepted" | "archived" | "refused";

const ALLOWED: FeedbackStatus[] = ["open", "accepted", "archived", "refused"];

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  if (!ALLOWED.includes(status)) return { ok: false, error: "Statut invalide." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  if (status === "refused") {
    // Refusé = suppression définitive
    const { error } = await admin.from("feedback").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("feedback")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Transforme un signalement en carte de la feuille de route (`platform_tasks`).
 * `roadmap_ref = "feedback:<id>"` sert de clé anti-doublon : rejouer l'action
 * (double clic, deux onglets) ne crée jamais une seconde carte, elle le dit.
 */
export async function createFeedbackCard(
  id: string
): Promise<{ ok: boolean; error?: string; alreadyExists?: boolean }> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const roadmapRef = `feedback:${id}`;

  const { data: existing, error: existingErr } = await admin
    .from("platform_tasks")
    .select("id")
    .eq("roadmap_ref", roadmapRef)
    .maybeSingle();
  if (existingErr) return { ok: false, error: existingErr.message };
  if (existing) return { ok: true, alreadyExists: true };

  const { data: fb, error: fbErr } = await admin
    .from("feedback")
    .select("id, type, description, url, page_title, platform")
    .eq("id", id)
    .maybeSingle();
  if (fbErr) return { ok: false, error: fbErr.message };
  if (!fb) return { ok: false, error: "Signalement introuvable." };

  const firstLine = (fb.description ?? "").split("\n")[0].trim();
  const title = firstLine.slice(0, 120) || "Signalement sans titre";

  const page = fb.page_title || fb.url || null;
  const description = [
    fb.description ?? "",
    page ? `\n\nSignalé sur : ${page}${fb.url ? ` (${fb.url})` : ""}` : "",
  ].join("");

  const platform = isAdminPlatform(fb.platform) && fb.platform !== "all" ? fb.platform : "admin";

  const { error: insertErr } = await admin.from("platform_tasks").insert({
    title,
    description,
    kind: fb.type === "bug" ? "bug" : "amelioration",
    platform,
    status: "a_trier",
    roadmap_ref: roadmapRef,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  const { error: updateErr } = await admin
    .from("feedback")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/admin/feedback");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function saveAdminNote(
  id: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const { error } = await admin
    .from("feedback")
    .update({ admin_note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/feedback");
  return { ok: true };
}
