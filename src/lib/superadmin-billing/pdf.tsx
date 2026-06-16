import "server-only";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";
import type { Invoice, InvoiceSettings } from "@/lib/invoicing/types";
import type { SaInvoice, SaInvoiceSettings } from "./types";

/** Mappe les types superadmin vers les formes attendues par le générateur PDF générique. */
function toInvoice(inv: SaInvoice): Invoice {
  return {
    id: inv.id,
    organization_id: "",
    number: inv.number,
    reference: null,
    object: inv.object,
    status: inv.status === "payee" ? "payee" : inv.status === "annulee" ? "annulee" : "emise",
    client_id: inv.client_id,
    client_name: inv.client_name,
    client_email: inv.client_email,
    client_address: inv.client_address,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    lines: inv.lines,
    vat_applicable: inv.vat_applicable,
    total_ht: inv.total_ht,
    total_vat: inv.total_vat,
    total_ttc: inv.total_ttc,
    notes: inv.notes,
    source: "manuelle",
    kind: "facture",
    parent_invoice_id: null,
    subscription_id: null,
    pole: null,
    pole_id: null,
    establishment_id: null,
    payment_method: inv.payment_method,
    paid_at: inv.paid_at,
    validation_status: null,
    validated_by: null,
    validated_at: null,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  };
}

function toSettings(s: SaInvoiceSettings): InvoiceSettings {
  return {
    organization_id: "",
    issuer_name: s.issuer_name,
    issuer_address: s.issuer_address,
    siret: s.siret,
    vat_number: s.vat_number,
    email: s.email,
    phone: s.phone,
    iban: s.iban,
    bic: s.bic,
    payment_terms_days: s.payment_terms_days,
    late_penalty: s.late_penalty,
    accent_color: s.accent_color,
    footer_mentions: s.footer_mentions,
    number_prefix: s.number_prefix,
    number_start: s.number_start,
    logo_url: null,
    require_validation_above: null,
    tax_receipt_quality: null,
    tax_receipt_signatory: null,
    tax_receipt_eligible: false,
    tax_receipt_rescrit_ref: null,
    updated_at: s.updated_at,
  };
}

export async function renderSaInvoicePdf(inv: SaInvoice, settings: SaInvoiceSettings): Promise<Buffer> {
  return renderInvoicePdf(toInvoice(inv), toSettings(settings));
}
