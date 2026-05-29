import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { demoOrgBySlug, demoPublicSiteBySlug } from "@/lib/demo/data";
import {
  addDemoRequest,
  getDemoRequests,
  updateDemoRequestStatus,
} from "@/lib/demo/store";
import type {
  IncomingRequest,
  Organization,
  PublicSite,
  RequestStatus,
} from "@/lib/types";

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
  if (!isSupabaseConfigured()) return getDemoRequests(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("received_at", { ascending: false });
  return data ?? [];
}

export interface NewRequestInput {
  organization_id: string;
  name: string;
  email: string;
  phone: string | null;
  organization_ext: string | null;
  type: string;
  message: string;
}

/** Crée une demande. Demo → store local ; sinon → insert Supabase (RLS). */
export async function createRequest(
  input: NewRequestInput
): Promise<IncomingRequest | null> {
  const summary =
    input.message.length > 120
      ? `${input.message.slice(0, 117)}…`
      : input.message;

  if (!isSupabaseConfigured()) {
    return addDemoRequest({ ...input, summary });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .insert({ ...input, summary, status: "nouvelle", priority: "normale" })
    .select("*")
    .single();
  return data;
}

/** Met à jour le statut d'une demande. Demo → store ; sinon → update Supabase. */
export async function updateRequestStatus(
  id: string,
  status: RequestStatus
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updateDemoRequestStatus(id, status) !== null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", id);
  return !error;
}
