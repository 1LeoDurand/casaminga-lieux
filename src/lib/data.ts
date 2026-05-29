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

  // Insertion via le client anon (policy `requests_insert_from_public_site`).
  // On NE fait PAS de `.select()` de retour : aucune policy SELECT n'autorise
  // l'anonyme à relire une demande (lecture réservée aux membres), donc un
  // `RETURNING *` reviendrait vide et ferait échouer l'enregistrement à tort.
  // On génère donc l'id côté serveur et on reconstruit la ligne créée.
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const { error } = await supabase.from("requests").insert({
    id,
    ...input,
    summary,
    status: "nouvelle",
    priority: "normale",
    received_at: receivedAt,
  });

  if (error) {
    console.error("createRequest: échec insertion Supabase", error);
    return null;
  }

  return {
    id,
    organization_id: input.organization_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    organization_ext: input.organization_ext,
    type: input.type,
    status: "nouvelle",
    priority: "normale",
    summary,
    message: input.message,
    received_at: receivedAt,
  };
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
