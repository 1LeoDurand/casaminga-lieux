import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { TaxReceipt, TaxReceiptInput } from "@/lib/invoicing/types";

export async function getTaxReceipts(orgId: string): Promise<TaxReceipt[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_receipts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TaxReceipt[];
}

export async function getTaxReceiptById(id: string): Promise<TaxReceipt | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as TaxReceipt | null;
}

/** Insère le reçu, puis appelle la RPC pour lui attribuer un numéro. */
export async function createTaxReceipt(
  input: TaxReceiptInput,
): Promise<{ ok: boolean; error?: string; receipt?: TaxReceipt }> {
  if (!isSupabaseConfigured())
    return { ok: false, error: "Supabase non configuré (mode démo)." };

  const supabase = await createClient();

  const { data: inserted, error: err } = await supabase
    .from("tax_receipts")
    .insert({
      organization_id: input.organization_id,
      donor_person_id: input.donor_person_id ?? null,
      donor_name:      input.donor_name,
      donor_address:   input.donor_address ?? null,
      amount:          input.amount,
      donation_date:   input.donation_date,
      donation_type:   input.donation_type,
      fiscal_year:     input.fiscal_year,
      transaction_id:  input.transaction_id ?? null,
    })
    .select("id")
    .single();

  if (err || !inserted) return { ok: false, error: err?.message ?? "Erreur insertion" };

  // Attribuer le numéro via la fonction SECURITY DEFINER
  await supabase.rpc("assign_receipt_number", {
    p_org:  input.organization_id,
    p_year: input.fiscal_year,
  });

  const receipt = await getTaxReceiptById(inserted.id);
  return { ok: true, receipt: receipt ?? undefined };
}

/** Totaux par donateur pour l'année (export annuel). */
export async function getAnnualDonorTotals(
  orgId: string,
  year: number,
): Promise<{ donor_name: string; donor_address: string | null; total: number; count: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_receipts")
    .select("donor_name, donor_address, amount")
    .eq("organization_id", orgId)
    .eq("fiscal_year", year);

  const map = new Map<string, { donor_name: string; donor_address: string | null; total: number; count: number }>();
  for (const r of data ?? []) {
    const key = r.donor_name;
    const existing = map.get(key);
    if (existing) {
      existing.total += Number(r.amount);
      existing.count += 1;
    } else {
      map.set(key, { donor_name: r.donor_name, donor_address: r.donor_address, total: Number(r.amount), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
