"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { Pole } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string; id?: string };

export async function getPolesForOrg(orgId: string): Promise<Pole[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("poles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getAllPolesForOrg(orgId: string): Promise<Pole[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("poles")
    .select("*")
    .eq("organization_id", orgId)
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export interface PoleInput {
  name: string;
  color: string;
  description?: string | null;
  active?: boolean;
  position?: number;
  establishment_id?: string | null;
}

export async function createPole(orgId: string, orgSlug: string, input: PoleInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poles")
    .insert({ organization_id: orgId, ...input })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  revalidatePath(`/dashboard/${orgSlug}/depenses`);
  return { ok: true, id: data.id };
}

export async function updatePole(orgSlug: string, id: string, input: Partial<PoleInput>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("poles").update(input).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  revalidatePath(`/dashboard/${orgSlug}/depenses`);
  return { ok: true };
}

export async function deletePole(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const supabase = await createClient();
  // Soft delete — désactive le pôle plutôt que de supprimer (FK sur factures/dépenses)
  const { error } = await supabase.from("poles").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}
