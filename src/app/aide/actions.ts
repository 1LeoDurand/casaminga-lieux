"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Vote public "cet article a-t-il aidé ?" (RPC SECURITY DEFINER, accessible anon). */
export async function voteHelpful(slug: string, helpful: boolean): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: true }; // démo : pas de persistance, on accepte
  try {
    const supabase = await createClient();
    await supabase.rpc("help_vote", { p_slug: slug, p_helpful: helpful });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
