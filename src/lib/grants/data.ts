import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GrantOpportunity, OrgGrantProfile, GrantApplication, ApplicationStatus } from "./types";

/** Opportunités publiées (vue org). */
export async function getOpportunities(): Promise<GrantOpportunity[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  // PostgREST plafonne à 1000 lignes/requête → on pagine par tranches.
  const PAGE = 1000;
  const all: GrantOpportunity[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data } = await supabase
      .from("grant_opportunities")
      .select("*")
      .eq("published", true)
      .order("deadline", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    const rows = (data as GrantOpportunity[]) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** Détail d'une opportunité par son ID. */
export async function getOpportunityById(id: string): Promise<GrantOpportunity | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("grant_opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as GrantOpportunity) ?? null;
}

/** Toutes les candidatures d'une org (map opportunity_id → application). */
export async function getApplications(orgId: string): Promise<Map<string, GrantApplication>> {
  if (!isSupabaseConfigured()) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("grant_applications")
    .select("*")
    .eq("organization_id", orgId);
  const map = new Map<string, GrantApplication>();
  for (const row of (data ?? []) as GrantApplication[]) {
    map.set(row.opportunity_id, row);
  }
  return map;
}

/** Upsert d'une candidature (création ou mise à jour du statut). */
export async function upsertApplication(
  orgId: string,
  opportunityId: string,
  status: ApplicationStatus,
  opts?: { notes?: string | null; amount_requested?: number | null; applied_at?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("grant_applications").upsert({
    organization_id: orgId,
    opportunity_id: opportunityId,
    status,
    notes: opts?.notes ?? null,
    amount_requested: opts?.amount_requested ?? null,
    applied_at: opts?.applied_at ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,opportunity_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Supprime une candidature (désabonner du suivi). */
export async function deleteApplication(orgId: string, opportunityId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("grant_applications")
    .delete()
    .eq("organization_id", orgId)
    .eq("opportunity_id", opportunityId);
  return { ok: !error };
}

export async function getOrgGrantProfile(orgId: string): Promise<OrgGrantProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_grant_profile")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return (data as OrgGrantProfile) ?? null;
}
