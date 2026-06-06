"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { Establishment } from "@/lib/types";

type AR = { ok: boolean; error?: string; id?: string };

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

export async function getEstablishments(orgId: string): Promise<Establishment[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishments")
    .select("*")
    .eq("organization_id", orgId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Establishment[];
}

export async function getActiveEstablishments(orgId: string): Promise<Establishment[]> {
  const all = await getEstablishments(orgId);
  return all.filter((e) => e.active);
}

export interface EstablishmentInput {
  name: string;
  slug?: string;
  city?: string | null;
  address?: string | null;
  siret?: string | null;
  description?: string | null;
  is_primary?: boolean;
}

export async function createEstablishment(orgId: string, orgSlug: string, input: EstablishmentInput): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const slug = input.slug?.trim() || slugify(input.name);
  const { data, error } = await supabase
    .from("establishments")
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      slug,
      city: input.city ?? null,
      address: input.address ?? null,
      siret: input.siret ?? null,
      description: input.description ?? null,
      is_primary: input.is_primary ?? false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true, id: data.id };
}

export async function updateEstablishment(orgSlug: string, id: string, input: Partial<EstablishmentInput>): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "city", "address", "siret", "description", "is_primary"] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }
  if (input.slug) patch.slug = slugify(input.slug);
  const { error } = await supabase.from("establishments").update(patch).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}

export async function setEstablishmentActive(orgSlug: string, id: string, active: boolean): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("establishments").update({ active }).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}
