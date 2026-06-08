import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SOCLE_KEYS, MODULE_SECTIONS, type OrgTier } from "@/lib/modules";
import { humanError } from "@/lib/errors";

export interface OrgSubscription {
  tier: OrgTier;
  status: string;
  comped: boolean;
  founding_member: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const FREE_SUB: OrgSubscription = {
  tier: "free", status: "active", comped: false,
  founding_member: false, trial_ends_at: null, current_period_end: null,
};

/** Tier effectif d'une org (comped/founding_member → traité comme "complete"). */
export function effectiveTier(sub: OrgSubscription): OrgTier {
  if (sub.comped || sub.founding_member) return "complete";
  if (sub.status === "canceled" || sub.status === "paused") return "free";
  return sub.tier;
}

/** Retourne l'abonnement de l'org, ou FREE par défaut. */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription> {
  if (!isSupabaseConfigured()) return { ...FREE_SUB, tier: "complete" }; // démo = tout débloqué
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, comped, founding_member, trial_ends_at, current_period_end")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) return FREE_SUB;
  return data as OrgSubscription;
}

/** Vérifie si un tier orgTier satisfait un tier requis minTier. */
export function tierSatisfies(orgTier: OrgTier, minTier: OrgTier): boolean {
  const ORDER: OrgTier[] = ["free", "complete", "multilieu"];
  return ORDER.indexOf(orgTier) >= ORDER.indexOf(minTier);
}

/**
 * Retourne l'ensemble des module_key activés pour une organisation.
 * Les modules socle (layer 0) sont toujours inclus.
 * En mode démo (Supabase non configuré), tous les modules sont activés.
 */
export async function getEnabledModules(orgId: string): Promise<Set<string>> {
  // Socle toujours actif
  const enabled = new Set<string>(SOCLE_KEYS);
  enabled.add("modules"); // page de gestion toujours accessible

  if (!isSupabaseConfigured()) {
    // Mode démo : tout activé
    MODULE_SECTIONS.forEach((s) => s.modules.forEach((m) => enabled.add(m.key)));
    return enabled;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", orgId);

  if (data) {
    for (const row of data) {
      if (row.enabled) enabled.add(row.module_key);
    }
  }

  return enabled;
}

/**
 * Active ou désactive un module pour une organisation.
 * Les modules socle ne peuvent pas être désactivés.
 */
export async function setModuleEnabled(
  orgId: string,
  moduleKey: string,
  enabled: boolean,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (SOCLE_KEYS.has(moduleKey)) {
    return { ok: false, error: "Ce module fait partie du socle et ne peut pas être désactivé." };
  }
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_modules")
    .upsert(
      {
        organization_id: orgId,
        module_key: moduleKey,
        enabled,
        activated_at: new Date().toISOString(),
        activated_by: userId ?? null,
      },
      { onConflict: "organization_id,module_key" }
    );

  if (error) return { ok: false, error: humanError(error) };
  return { ok: true };
}
