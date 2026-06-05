/**
 * Resolvers pour les blocs dynamiques : vont chercher les données live au moment de l'envoi.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Evenement } from "@/lib/types";

// ─── Événements futurs publiés ─────────────────────────────────────────────────

export async function resolveEvents(orgId: string, count = 6): Promise<Evenement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("evenements")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "publie")
    .gt("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(count);
  return data ?? [];
}

// ─── Campagnes d'adhésion actives ──────────────────────────────────────────────

export async function resolveCampaigns(
  orgId: string
): Promise<{ id: string; title: string; slug: string; tiers: { amount: number }[] }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: camps } = await supabase
    .from("membership_campaigns")
    .select("id, title, slug")
    .eq("organization_id", orgId)
    .eq("status", "publie");
  if (!camps?.length) return [];

  const result = await Promise.all(
    camps.map(async (c) => {
      const { data: tiers } = await supabase
        .from("membership_tiers")
        .select("amount")
        .eq("campaign_id", c.id);
      return { ...c, tiers: tiers ?? [] };
    })
  );
  return result;
}

// ─── Espaces ───────────────────────────────────────────────────────────────────

export async function resolveSpaces(
  orgId: string,
  count = 4
): Promise<{ id: string; name: string; type: string; description: string | null }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, name, type, description")
    .eq("organization_id", orgId)
    .limit(count);
  return data ?? [];
}

// ─── Résolution complète (pour le renderer) ────────────────────────────────────

export async function resolveAllBlocks(orgId: string) {
  const [events, campaigns, spaces] = await Promise.all([
    resolveEvents(orgId, 6),
    resolveCampaigns(orgId),
    resolveSpaces(orgId, 4),
  ]);
  return { events, campaigns, spaces };
}

// ─── Nouveaux événements depuis une date (pour mode sur_evenement) ─────────────

export async function countNewEventsSince(orgId: string, since: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("evenements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "publie")
    .gt("created_at", since);
  return count ?? 0;
}
