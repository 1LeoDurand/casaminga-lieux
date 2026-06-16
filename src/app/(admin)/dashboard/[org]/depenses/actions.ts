"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { Expense, ExpenseCategory } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string; id?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Dépenses disponibles une fois Supabase configuré.",
};

export interface ExpenseInput {
  label: string;
  amount_ttc: number;
  vat_applicable: boolean;
  vat_amount: number | null;
  category: ExpenseCategory | null;
  supplier_name: string | null;
  supplier_person_id: string | null;
  pole_id: string | null;
  establishment_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  notes: string | null;
  spent_at: string;
}

export async function getExpensesForOrg(orgId: string): Promise<Expense[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("organization_id", orgId)
    .order("spent_at", { ascending: false });
  return data ?? [];
}

export async function saveExpense(
  orgId: string,
  orgSlug: string,
  input: ExpenseInput,
  id?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const payload = {
    organization_id: orgId,
    label: input.label,
    amount_ttc: input.amount_ttc,
    vat_applicable: input.vat_applicable,
    vat_amount: input.vat_amount,
    category: input.category,
    supplier_name: input.supplier_name,
    supplier_person_id: input.supplier_person_id || null,
    pole_id: input.pole_id || null,
    establishment_id: input.establishment_id || null,
    payment_method: input.payment_method,
    paid_at: input.paid_at,
    receipt_url: input.receipt_url,
    notes: input.notes,
    spent_at: input.spent_at,
  };

  if (id) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/depenses`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/depenses`);
  return { ok: true, id: data.id };
}

export async function deleteExpense(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/depenses`);
  return { ok: true };
}
