"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";

export type FeedbackStatus = "open" | "in_progress" | "resolved" | "dismissed";

const ALLOWED: FeedbackStatus[] = ["open", "in_progress", "resolved", "dismissed"];

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<{ ok: boolean; error?: string }> {
  // Sécurité : seul un super-admin peut modifier un ticket.
  await requireSuperAdmin();

  if (!ALLOWED.includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const { error } = await admin
    .from("feedback")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return { ok: true };
}
