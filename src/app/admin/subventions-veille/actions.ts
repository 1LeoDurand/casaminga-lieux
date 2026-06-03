"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import type { GrantOpportunity } from "@/lib/grants/types";

type Result = { ok: boolean; error?: string };

export type OpportunityInput = Omit<GrantOpportunity, "id" | "source" | "external_id"> & {
  id?: string;
};

export async function saveOpportunity(input: OpportunityInput): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  if (!input.title.trim()) return { ok: false, error: "Titre requis." };

  const payload = {
    title: input.title.trim(),
    funder: input.funder,
    funder_type: input.funder_type,
    themes: input.themes,
    regions: input.regions,
    structure_types: input.structure_types,
    amount_min: input.amount_min,
    amount_max: input.amount_max,
    deadline: input.deadline,
    recurring: input.recurring,
    application_url: input.application_url,
    required_documents: input.required_documents,
    description: input.description,
    published: input.published,
    source: "manuel" as const,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await admin.from("grant_opportunities").update(payload).eq("id", input.id)
    : await admin.from("grant_opportunities").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/subventions-veille");
  return { ok: true };
}

export async function deleteOpportunity(id: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  const { error } = await admin.from("grant_opportunities").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/subventions-veille");
  return { ok: true };
}
