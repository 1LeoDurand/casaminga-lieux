"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import type { ModStatus } from "@/lib/admin/data";

type Res = { ok: boolean; error?: string };

/** Modère un lieu : site public OU portail casaminga.com. */
export async function setLieuModeration(
  id: string,
  field: "public_site_status" | "portal_status",
  status: ModStatus
): Promise<Res> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };
  const { error } = await admin.from("establishments").update({ [field]: status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  return { ok: true };
}

/** Valide / refuse un événement pour le portail casaminga.com. */
export async function setEventPortalStatus(id: string, status: ModStatus): Promise<Res> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };
  const { error } = await admin.from("evenements").update({ portal_status: status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  return { ok: true };
}
