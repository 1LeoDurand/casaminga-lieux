"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { createGrant } from "@/lib/data";
import type { ApplicationStatus } from "@/lib/grants/types";
import type { GrantFunderType } from "@/lib/types";

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

/**
 * Upsert d'une candidature.
 * Si le statut passe à "obtenu", crée automatiquement une convention de subvention
 * dans la table `grants` (si aucune n'est encore liée).
 */
export async function upsertApplicationAction(
  orgId: string,
  orgSlug: string,
  opportunityId: string,
  status: ApplicationStatus,
  opts?: {
    notes?: string | null;
    amount_requested?: number | null;
    applied_at?: string | null;
    /** Infos pour créer la convention quand status = "obtenu" */
    opportunityTitle?: string;
    opportunityFunder?: string | null;
    opportunityFunderType?: string | null;
    opportunityAmountMax?: number | null;
  }
): Promise<Result & { linked_grant_id?: string | null }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();

  // Upsert the application
  const { error, data } = await supabase
    .from("grant_applications")
    .upsert(
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
    )
    .select("id, linked_grant_id")
    .single();

  if (error) return { ok: false, error: humanError(error) };

  const appId = data?.id as string;
  let linkedGrantId = (data?.linked_grant_id as string | null) ?? null;

  // Si "obtenu" et pas encore de subvention liée → créer une convention brouillon
  if (status === "obtenu" && !linkedGrantId) {
    const funderTypeRaw = opts?.opportunityFunderType ?? "";
    // Mapping FunderType (veille) → GrantFunderType (conventions)
    const funderTypeMap: Record<string, GrantFunderType> = {
      etat: "public", region: "public", departement: "public",
      europe: "europe", fondation: "fondation", autre: "prive",
    };
    const funderType: GrantFunderType = funderTypeMap[funderTypeRaw] ?? "public";

    const newGrantId = await createGrant({
      organization_id: orgId,
      title: opts?.opportunityTitle ?? "Subvention à compléter",
      funder: opts?.opportunityFunder ?? "—",
      funder_type: funderType,
      amount: opts?.amount_requested ?? opts?.opportunityAmountMax ?? 0,
      amount_received: 0,
      start_date: null,
      end_date: null,
      status: "en_cours",
      convention_ref: null,
      description: `Créée automatiquement depuis la veille subventions (candidature ${appId}).`,
      reporting_due_date: null,
      kpi_beneficiaires: null,
      kpi_heures: null,
      kpi_artistes: null,
      kpi_evenements: null,
      kpi_note: null,
    });

    if (newGrantId) {
      await supabase
        .from("grant_applications")
        .update({ linked_grant_id: newGrantId })
        .eq("id", appId);
      linkedGrantId = newGrantId;
      revalidatePath(`/dashboard/${orgSlug}/subventions`);
    }
  }

  revalidatePath(`/dashboard/${orgSlug}/subventions/veille`);
  return { ok: true, linked_grant_id: linkedGrantId };
}

/** Retire une candidature du suivi. */
export async function deleteApplicationAction(
  orgId: string,
  orgSlug: string,
  opportunityId: string
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("grant_applications")
    .delete()
    .eq("organization_id", orgId)
    .eq("opportunity_id", opportunityId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/subventions/veille`);
  return { ok: true };
}
