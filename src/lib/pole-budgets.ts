"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

export interface PoleBudget {
  id: string;
  organization_id: string;
  pole_id: string;
  fiscal_year: number;
  allocated_amount: number;
}

/** Synthèse financière d'un pôle : alloué / dépensé / encaissé / reste. */
export interface PoleFinancials {
  pole_id: string;
  allocated: number;
  spent: number;    // dépenses payées
  earned: number;   // factures payées
  remaining: number; // alloué - dépensé
}

type AR = { ok: boolean; error?: string };

export async function getPoleBudgets(orgId: string, year: number): Promise<Map<string, number>> {
  if (!isSupabaseConfigured()) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("pole_budgets")
    .select("pole_id, allocated_amount")
    .eq("organization_id", orgId)
    .eq("fiscal_year", year);
  return new Map((data ?? []).map((b: { pole_id: string; allocated_amount: number }) => [b.pole_id, Number(b.allocated_amount)]));
}

export async function setPoleBudget(orgSlug: string, orgId: string, poleId: string, year: number, amount: number): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pole_budgets")
    .upsert({ organization_id: orgId, pole_id: poleId, fiscal_year: year, allocated_amount: amount },
      { onConflict: "pole_id,fiscal_year" });
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return { ok: true };
}

/** Calcule dépensé (expenses payées) + encaissé (invoices payées) par pôle pour l'année. */
export async function getPoleFinancials(orgId: string, year: number): Promise<Map<string, { spent: number; earned: number }>> {
  if (!isSupabaseConfigured()) return new Map();
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [{ data: exp }, { data: inv }] = await Promise.all([
    supabase.from("expenses")
      .select("pole_id, amount_ttc, paid_at")
      .eq("organization_id", orgId)
      .not("paid_at", "is", null)
      .gte("paid_at", start).lte("paid_at", end),
    supabase.from("invoices")
      .select("pole_id, total_ttc, status, paid_at")
      .eq("organization_id", orgId)
      .eq("status", "payee")
      .gte("paid_at", start).lte("paid_at", end),
  ]);

  const map = new Map<string, { spent: number; earned: number }>();
  const slot = (id: string) => {
    if (!map.has(id)) map.set(id, { spent: 0, earned: 0 });
    return map.get(id)!;
  };
  for (const e of exp ?? []) {
    if (!e.pole_id) continue;
    slot(e.pole_id).spent += Number(e.amount_ttc);
  }
  for (const i of inv ?? []) {
    if (!i.pole_id) continue;
    slot(i.pole_id).earned += Number(i.total_ttc);
  }
  return map;
}
