"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { PoleRole } from "@/lib/pole-meta";

export interface PoleMember {
  id: string;
  pole_id: string;
  user_id: string;
  pole_role: PoleRole;
}

type AR = { ok: boolean; error?: string };

export async function getPoleMembers(orgId: string): Promise<PoleMember[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pole_members")
    .select("id, pole_id, user_id, pole_role")
    .eq("organization_id", orgId);
  return (data ?? []) as PoleMember[];
}

export async function assignPoleMember(
  orgSlug: string, orgId: string, poleId: string, userId: string, role: PoleRole
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pole_members")
    .upsert({ organization_id: orgId, pole_id: poleId, user_id: userId, pole_role: role },
      { onConflict: "pole_id,user_id" });
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}

export async function removePoleMember(orgSlug: string, poleId: string, userId: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pole_members")
    .delete()
    .eq("pole_id", poleId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}
