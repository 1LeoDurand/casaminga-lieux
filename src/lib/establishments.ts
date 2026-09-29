"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { geocodeAddress } from "@/lib/geocode";
import type { Establishment } from "@/lib/types";

type AR = { ok: boolean; error?: string; id?: string; warning?: string };

const NOT_LOCATED = "Adresse non localisée : vérifiez l'orthographe ou la ville.";

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

/** Résolution publique : un slug d'établissement → l'établissement + le slug de son org.
 *  Sert aux vitrines casaminga.com/<slug-établissement>. */
export async function getEstablishmentForPublic(
  slug: string
): Promise<{ establishment: Establishment; orgSlug: string } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishments")
    .select("*, organizations(slug)")
    .eq("slug", slug)
    .eq("active", true)
    .eq("public_site_status", "approved")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const orgSlug = (data as { organizations?: { slug: string } }).organizations?.slug;
  if (!orgSlug) return null;
  return { establishment: data as Establishment, orgSlug };
}

export interface EstablishmentInput {
  name: string;
  slug?: string;
  city?: string | null;
  address?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  siret?: string | null;
  description?: string | null;
  is_primary?: boolean;
}

export async function createEstablishment(orgId: string, orgSlug: string, input: EstablishmentInput): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const slug = input.slug?.trim() || slugify(input.name);
  let latitude = input.latitude ?? null;
  let longitude = input.longitude ?? null;
  let warning: string | undefined;
  if ((latitude === null || longitude === null) && (input.address?.trim() || input.city?.trim())) {
    const geo = await geocodeAddress({ address: input.address, postalCode: input.postal_code, city: input.city });
    if (geo) { latitude = geo.lat; longitude = geo.lng; } else warning = NOT_LOCATED;
  }
  const { data, error } = await supabase
    .from("establishments")
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      slug,
      city: input.city ?? null,
      address: input.address ?? null,
      postal_code: input.postal_code ?? null,
      latitude,
      longitude,
      siret: input.siret ?? null,
      description: input.description ?? null,
      is_primary: input.is_primary ?? false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true, id: data.id, warning };
}

export async function updateEstablishment(orgSlug: string, id: string, input: Partial<EstablishmentInput>): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "city", "address", "postal_code", "latitude", "longitude", "siret", "description", "is_primary"] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }
  if (input.slug) patch.slug = slugify(input.slug);

  // Geocode when the address changed or the coordinates are still empty,
  // unless the caller sent fresh coordinates (address autocomplete pick).
  let warning: string | undefined;
  const { data: cur } = await supabase
    .from("establishments")
    .select("address, postal_code, city, latitude, longitude")
    .eq("id", id)
    .maybeSingle();
  if (cur) {
    const next = {
      address: (patch.address !== undefined ? patch.address : cur.address) as string | null,
      postal_code: (patch.postal_code !== undefined ? patch.postal_code : cur.postal_code) as string | null,
      city: (patch.city !== undefined ? patch.city : cur.city) as string | null,
    };
    const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const changed = norm(next.address) !== norm(cur.address) || norm(next.postal_code) !== norm(cur.postal_code) || norm(next.city) !== norm(cur.city);
    const lat = patch.latitude !== undefined ? (patch.latitude as number | null) : cur.latitude;
    const lng = patch.longitude !== undefined ? (patch.longitude as number | null) : cur.longitude;
    const freshCoords = lat !== null && lng !== null && (lat !== cur.latitude || lng !== cur.longitude);
    const empty = lat === null || lng === null;
    if (!freshCoords && (changed || empty) && (next.address?.trim() || next.city?.trim())) {
      const geo = await geocodeAddress({ address: next.address, postalCode: next.postal_code, city: next.city });
      if (geo) { patch.latitude = geo.lat; patch.longitude = geo.lng; }
      else {
        warning = NOT_LOCATED;
        // A changed address must not keep the old, now wrong, position.
        if (changed) { patch.latitude = null; patch.longitude = null; }
      }
    }
  }
  const { error } = await supabase.from("establishments").update(patch).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true, warning };
}

export async function setEstablishmentActive(orgSlug: string, id: string, active: boolean): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("establishments").update({ active }).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}
