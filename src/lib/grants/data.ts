import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GrantOpportunity, OrgGrantProfile } from "./types";

/** Opportunités publiées (vue org). */
export async function getOpportunities(): Promise<GrantOpportunity[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("grant_opportunities")
    .select("*")
    .eq("published", true)
    .order("deadline", { ascending: true, nullsFirst: false });
  return (data as GrantOpportunity[]) ?? [];
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
