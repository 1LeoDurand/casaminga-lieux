"use server";
import { revalidatePath } from "next/cache";
import { createTaxReceipt } from "@/lib/tax-receipts/data";
import { getOrganizationBySlug } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DonationType } from "@/lib/invoicing/types";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/factures/recus`);
}

export async function createTaxReceiptAction(
  orgSlug: string,
  formData: {
    donorName: string;
    donorAddress: string;
    amount: string;
    donationDate: string;
    donationType: DonationType;
    fiscalYear: string;
    donorPersonId?: string;
    transactionId?: string;
  },
) {
  if (!isSupabaseConfigured()) return { ok: false, error: "Mode démo — reçus désactivés." };

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable." };

  const amount = parseFloat(formData.amount);
  if (isNaN(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };

  const res = await createTaxReceipt({
    organization_id: org.id,
    donor_name:      formData.donorName.trim(),
    donor_address:   formData.donorAddress.trim() || null,
    amount,
    donation_date:   formData.donationDate,
    donation_type:   formData.donationType,
    fiscal_year:     parseInt(formData.fiscalYear, 10),
    donor_person_id: formData.donorPersonId || null,
    transaction_id:  formData.transactionId || null,
  });

  if (res.ok) refresh(orgSlug);
  return res;
}
