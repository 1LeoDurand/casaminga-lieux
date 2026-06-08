"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import type { OrgTier } from "@/lib/modules";

type AR = { ok: boolean; error?: string };

export async function setOrgTier(
  orgId: string,
  tier: OrgTier,
  opts: { comped?: boolean; founding_member?: boolean; notes?: string } = {}
): Promise<AR> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service role non configuré." };

  const payload = {
    organization_id: orgId,
    tier,
    status: "active",
    comped: opts.comped ?? false,
    founding_member: opts.founding_member ?? false,
    notes: opts.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "organization_id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/organisations");
  return { ok: true };
}
