import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GrantOpportunity, OrgGrantProfile, GrantApplication, ApplicationStatus } from "./types";
import { regionFromPostalCode } from "./taxonomy";

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

/** Un dossier suivi = une candidature + l'opportunité correspondante (jointure applicative). */
export interface FollowedDossier {
  application: GrantApplication;
  opportunity: GrantOpportunity | null;
}

/**
 * Dossiers suivis par l'org (toute candidature ayant un statut), enrichis du
 * détail de l'opportunité. Alimente le hub Subventions et le bloc « Mes
 * dossiers » : ce qu'on suit doit remonter au lieu de se perdre dans le catalogue.
 */
export async function getFollowedDossiers(orgId: string): Promise<FollowedDossier[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("grant_applications")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });
  const applications = (apps ?? []) as GrantApplication[];
  if (applications.length === 0) return [];

  const oppIds = [...new Set(applications.map((a) => a.opportunity_id))];
  const oppById = new Map<string, GrantOpportunity>();
  // `.in()` borné — découpe par paquets de 300 (URL raisonnable).
  for (let i = 0; i < oppIds.length; i += 300) {
    const { data } = await supabase
      .from("grant_opportunities")
      .select("*")
      .in("id", oppIds.slice(i, i + 300));
    for (const o of (data ?? []) as GrantOpportunity[]) oppById.set(o.id, o);
  }

  return applications.map((application) => ({
    application,
    opportunity: oppById.get(application.opportunity_id) ?? null,
  }));
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

/**
 * Régions couvertes par l'organisation, dérivées des codes postaux de ses
 * établissements actifs (gestion multi-lieu : un tiers-lieu peut avoir plusieurs
 * sites dans des régions différentes). Sert d'appoint géo au scoring en plus de
 * la région du profil. Renvoie [] si aucun CP exploitable.
 */
export async function getOrgGeoContext(orgId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishments")
    .select("postal_code, active")
    .eq("organization_id", orgId);
  const regions = new Set<string>();
  for (const e of (data ?? []) as { postal_code: string | null; active: boolean | null }[]) {
    if (e.active === false) continue;
    const r = regionFromPostalCode(e.postal_code);
    if (r) regions.add(r);
  }
  return [...regions];
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
