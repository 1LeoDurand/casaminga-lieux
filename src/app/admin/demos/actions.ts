"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { seedDemoOrg, resetDemoOrg, deleteDemoOrg, type DemoArchetype } from "@/lib/admin/demo-seeder";

/** Crée ou recrée une org de démo à partir de zéro. */
export async function createDemoOrgAction(
  archetype: DemoArchetype
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const res = await seedDemoOrg(archetype);
  revalidatePath("/admin/demos");
  revalidatePath("/admin");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Réinitialise une org démo (efface tout + re-seed). */
export async function resetDemoOrgAction(
  archetype: DemoArchetype
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  const res = await resetDemoOrg(archetype);
  revalidatePath("/admin/demos");
  return res;
}

/** Supprime définitivement une org démo. */
export async function deleteDemoOrgAction(
  orgId: string
): Promise<{ ok: boolean }> {
  await requireSuperAdmin();
  const res = await deleteDemoOrg(orgId);
  revalidatePath("/admin/demos");
  revalidatePath("/admin");
  return res;
}
