"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Result = { ok: boolean; error?: string };

export async function saveGrantProfile(
  orgId: string,
  orgSlug: string,
  input: {
    region: string | null;
    structure_type: string | null;
    themes: string[];
    annual_budget: number | null;
    project_summary: string | null;
  }
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("org_grant_profile").upsert(
    { organization_id: orgId, ...input, updated_at: new Date().toISOString() },
    { onConflict: "organization_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${orgSlug}/subventions/veille`);
  return { ok: true };
}
