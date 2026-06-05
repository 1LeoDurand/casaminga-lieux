"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

export interface CashPointing {
  id: string;
  organization_id: string;
  entry_id: string;
  pointed_at: string;
  operator: string | null;
}

type AR = { ok: boolean; error?: string };

/** Liste les IDs d'écritures déjà pointées pour une org. */
export async function getPointedEntryIds(orgId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_pointings")
    .select("entry_id")
    .eq("organization_id", orgId);
  return new Set((data ?? []).map((r: { entry_id: string }) => r.entry_id));
}

/** Coche (pointe) une écriture — INSERT dans la table de rapprochement (ne touche PAS le registre certifié). */
export async function pointEntry(orgSlug: string, orgId: string, entryId: string, operator: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_pointings")
    .upsert({ organization_id: orgId, entry_id: entryId, operator }, { onConflict: "organization_id,entry_id" });
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/caisse`);
  return { ok: true };
}

/** Dé-pointe une écriture — DELETE dans la table de rapprochement. */
export async function unpointEntry(orgSlug: string, orgId: string, entryId: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_pointings")
    .delete()
    .eq("organization_id", orgId)
    .eq("entry_id", entryId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/caisse`);
  return { ok: true };
}
