import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  demoOrgBySlug,
  demoPublicSiteBySlug,
  demoRequestsForOrg,
} from "@/lib/demo/data";
import type { IncomingRequest, Organization, PublicSite } from "@/lib/types";

/**
 * Accès aux données du socle.
 * Mode démo (Supabase non configuré) → données seed locales.
 * Sinon → requêtes Supabase (isolation par RLS / organization_id).
 */

export async function getOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  if (!isSupabaseConfigured()) return demoOrgBySlug(slug) ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getPublicSiteBySlug(
  slug: string
): Promise<PublicSite | null> {
  if (!isSupabaseConfigured()) return demoPublicSiteBySlug(slug) ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("organization_id, slug, title, status, seo_description")
    .eq("slug", slug)
    .eq("status", "publie")
    .maybeSingle();
  return data;
}

export async function getRequestsForOrg(
  orgId: string
): Promise<IncomingRequest[]> {
  if (!isSupabaseConfigured()) return demoRequestsForOrg(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("received_at", { ascending: false });
  return data ?? [];
}
