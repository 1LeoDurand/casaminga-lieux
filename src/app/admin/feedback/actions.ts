"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";

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
