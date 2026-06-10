"use server";
import { revalidatePath } from "next/cache";
import { createTaxReceipt, getTaxReceiptById } from "@/lib/tax-receipts/data";
import { getOrganizationBySlug } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getInvoiceSettings } from "@/lib/invoicing/data";
import { renderTaxReceiptPdf } from "@/lib/tax-receipts/pdf";
import { sendMail } from "@/lib/mail";
import { tplReceiptEmail } from "@/lib/mail-templates";
import { createAdminClient } from "@/lib/admin/guard";
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

export async function sendTaxReceiptAction(
  orgSlug: string,
  receiptId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Mode démo — envoi désactivé." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Client admin non disponible." };

  const [org, receipt] = await Promise.all([
    getOrganizationBySlug(orgSlug),
    getTaxReceiptById(receiptId),
  ]);
  if (!org) return { ok: false, error: "Organisation introuvable." };
  if (!receipt || receipt.organization_id !== org.id) return { ok: false, error: "Reçu introuvable." };

  if (!receipt.donor_person_id) {
    return { ok: false, error: "Pas d'email : le donateur n'est pas lié à une fiche membre." };
  }

  const { data: person } = await admin
    .from("persons")
    .select("email, name")
    .eq("id", receipt.donor_person_id)
    .maybeSingle();

  if (!person?.email) {
    return { ok: false, error: "Aucun email renseigné pour ce donateur." };
  }

  const settings = await getInvoiceSettings(org.id);
  const pdfBuffer = await renderTaxReceiptPdf(receipt, settings);

  const ok = await sendMail({
    to: person.email,
    subject: `Votre reçu fiscal ${receipt.fiscal_year} — ${org.name}`,
    html: tplReceiptEmail({
      orgName: org.name,
      donorName: receipt.donor_name,
      year: receipt.fiscal_year,
      amount: Number(receipt.amount),
    }),
    category: "recu-fiscal",
    organizationId: org.id,
    attachments: [{
      filename: `recu-${receipt.number ?? receipt.id.slice(0, 8)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });

  return ok ? { ok: true } : { ok: false, error: "Erreur lors de l'envoi." };
}
