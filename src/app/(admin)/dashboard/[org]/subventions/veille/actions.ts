"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { ApplicationStatus } from "@/lib/grants/types";

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
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/subventions/veille`);
  return { ok: true };
}

export async function upsertApplicationAction(
  orgId: string,
  orgSlug: string,
  opportunityId: string,
  status: ApplicationStatus,
  opts?: { notes?: string | null; amount_requested?: number | null; applied_at?: string | null }
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("grant_applications").upsert(
    {
      organization_id: orgId,
      opportunity_id: opportunityId,
      status,
      notes: opts?.notes ?? null,
      amount_requested: opts?.amount_requested ?? null,
      applied_at: opts?.applied_at ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,opportunity_id" }
  );
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/subventions/veille`);
  return { ok: true };
}
