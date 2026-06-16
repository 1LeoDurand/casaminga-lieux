"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { sendMail } from "@/lib/mail";
import { tplFactureEcommunication } from "@/lib/mail-templates";
import {
  computeTotals,
  type InvoiceLine,
  type SaInvoiceStatus,
  type SaPaymentMethod,
} from "@/lib/superadmin-billing/types";
import { getSaInvoiceById, getSaSettings, nextSaInvoiceNumber } from "@/lib/superadmin-billing/data";
import { renderSaInvoicePdf } from "@/lib/superadmin-billing/pdf";

type ActionResult = { ok: boolean; error?: string; id?: string };

async function adminOrThrow() {
  await requireSuperAdmin();
  const sb = createAdminClient();
  if (!sb) throw new Error("Service-role indisponible (mode démo).");
  return sb;
}

export interface SaInvoiceInput {
  id?: string;
  object: string | null;
  status: SaInvoiceStatus;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  issue_date: string | null;
  due_date: string | null;
  lines: InvoiceLine[];
  vat_applicable: boolean;
  notes: string | null;
  payment_method: SaPaymentMethod | null;
  paid_at: string | null;
}

export async function saveSaInvoice(input: SaInvoiceInput): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const totals = computeTotals(input.lines, input.vat_applicable);

    // Attribution du numéro dès que la facture quitte le brouillon (si pas déjà numérotée).
    let number: string | null = null;
    if (input.id) {
      const existing = await getSaInvoiceById(input.id);
      number = existing?.number ?? null;
    }
    if (!number && input.status !== "brouillon") {
      const settings = await getSaSettings();
      number = await nextSaInvoiceNumber(settings, input.issue_date);
    }

    const row = {
      object: input.object,
      status: input.status,
      client_id: input.client_id,
      client_name: input.client_name,
      client_email: input.client_email,
      client_address: input.client_address,
      issue_date: input.issue_date,
      due_date: input.due_date,
      lines: input.lines,
      vat_applicable: input.vat_applicable,
      total_ht: totals.total_ht,
      total_vat: totals.total_vat,
      total_ttc: totals.total_ttc,
      notes: input.notes,
      payment_method: input.payment_method,
      paid_at: input.status === "payee" ? input.paid_at ?? new Date().toISOString() : input.paid_at,
      number,
      updated_at: new Date().toISOString(),
    };

    let id = input.id;
    if (id) {
      const { error } = await sb.from("sa_invoices").update(row).eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await sb.from("sa_invoices").insert(row).select("id").single();
      if (error) return { ok: false, error: error.message };
      id = (data as { id: string }).id;
    }
    revalidatePath("/admin/facturation");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function deleteSaInvoice(id: string): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const { error } = await sb.from("sa_invoices").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/facturation");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function markSaInvoicePaid(id: string, paid: boolean): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const { error } = await sb
      .from("sa_invoices")
      .update({
        status: paid ? "payee" : "emise",
        paid_at: paid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/facturation");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

/** Envoie la facture par email avec le PDF en pièce jointe, puis marque « envoyée ». */
export async function sendSaInvoice(id: string): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const invoice = await getSaInvoiceById(id);
    if (!invoice) return { ok: false, error: "Facture introuvable." };
    if (!invoice.client_email) return { ok: false, error: "Aucun email client renseigné." };
    if (!invoice.number) return { ok: false, error: "Émettez la facture (attribuez un numéro) avant l'envoi." };

    const settings = await getSaSettings();
    const pdf = await renderSaInvoicePdf(invoice, settings);

    const sent = await sendMail({
      to: invoice.client_email,
      subject: `Facture ${invoice.number} — ${settings.issuer_name ?? "ecommunication"}`,
      html: tplFactureEcommunication({
        issuerName: settings.issuer_name ?? "ecommunication",
        clientName: invoice.client_name,
        number: invoice.number,
        object: invoice.object,
        amountEuros: invoice.total_ttc,
        dueDate: invoice.due_date,
        iban: settings.iban,
        bic: settings.bic,
      }),
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }],
      category: "facture-ecommunication",
      organizationId: null,
    });
    if (!sent) return { ok: false, error: "Échec de l'envoi (SMTP)." };

    await sb
      .from("sa_invoices")
      .update({
        status: invoice.status === "payee" ? "payee" : "envoyee",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidatePath("/admin/facturation");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

// ── Clients ─────────────────────────────────────────────────────────────────

export async function saveSaClient(input: {
  id?: string;
  organization_id: string | null;
  name: string;
  email: string | null;
  address: string | null;
  siret: string | null;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const row = {
      organization_id: input.organization_id,
      name: input.name,
      email: input.email,
      address: input.address,
      siret: input.siret,
      notes: input.notes,
    };
    if (input.id) {
      const { error } = await sb.from("sa_clients").update(row).eq("id", input.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb.from("sa_clients").insert(row);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/facturation");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function deleteSaClient(id: string): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const { error } = await sb.from("sa_clients").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/facturation");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

// ── Catalogue de tarifs ──────────────────────────────────────────────────────

export async function savePricingItem(input: {
  id?: string;
  label: string;
  description: string | null;
  unit_ht: number;
  vat_rate: number;
  active: boolean;
  sort_order: number;
}): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const row = {
      label: input.label,
      description: input.description,
      unit_ht: input.unit_ht,
      vat_rate: input.vat_rate,
      active: input.active,
      sort_order: input.sort_order,
    };
    if (input.id) {
      const { error } = await sb.from("sa_pricing_items").update(row).eq("id", input.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb.from("sa_pricing_items").insert(row);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/facturation/tarifs");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function deletePricingItem(id: string): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const { error } = await sb.from("sa_pricing_items").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/facturation/tarifs");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

// ── Paramètres émetteur ──────────────────────────────────────────────────────

export async function saveSaSettings(input: {
  issuer_name: string | null;
  issuer_address: string | null;
  siret: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  payment_terms_days: number;
  number_prefix: string;
  number_start: number;
  vat_applicable: boolean;
  footer_mentions: string | null;
}): Promise<ActionResult> {
  try {
    const sb = await adminOrThrow();
    const { error } = await sb
      .from("sa_invoice_settings")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/facturation/parametres");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
