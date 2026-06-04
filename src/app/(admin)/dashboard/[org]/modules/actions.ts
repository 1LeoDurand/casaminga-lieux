"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SOCLE_KEYS } from "@/lib/modules";

export async function toggleModuleAction(
  orgId: string,
  orgSlug: string,
  moduleKey: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (SOCLE_KEYS.has(moduleKey)) {
    return { ok: false, error: "Ce module fait partie du socle et ne peut pas être modifié." };
  }
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("organization_modules")
    .upsert(
      {
        organization_id: orgId,
        module_key: moduleKey,
        enabled,
        activated_at: new Date().toISOString(),
        activated_by: user?.id ?? null,
      },
      { onConflict: "organization_id,module_key" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${orgSlug}/modules`);
  revalidatePath(`/dashboard/${orgSlug}`);
  return { ok: true };
}
