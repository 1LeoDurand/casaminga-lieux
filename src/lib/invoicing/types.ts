/** Types & helpers du module Facturation. Purs (aucun import serveur) :
 *  importables aussi bien côté serveur que client. */

export type InvoiceStatus =
  | "brouillon"
  | "emise"
  | "envoyee"
  | "payee"
  | "en_retard"
  | "annulee";

export type InvoiceSource = "manuelle" | "abonnement";

export interface InvoiceLine {
  designation: string;
  qty: number;
  unit_ht: number;   // prix unitaire HT
  vat_rate: number;  // 0 | 2.1 | 5.5 | 10 | 20
}

export interface Invoice {
  id: string;
  organization_id: string;
  number: string | null;
  status: InvoiceStatus;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  issue_date: string | null;
  due_date: string | null;
  lines: InvoiceLine[];
  vat_applicable: boolean;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  notes: string | null;
  source: InvoiceSource;
  created_at: string;
  updated_at: string;
}

export interface InvoiceSettings {
  organization_id: string;
  issuer_name: string | null;
  issuer_address: string | null;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  payment_terms_days: number;
  late_penalty: string | null;
  accent_color: string;
  footer_mentions: string | null;
  number_prefix: string;
  logo_url: string | null;
  updated_at: string;
}

export const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-slate-100 text-slate-600" },
  emise:     { label: "Émise",     cls: "bg-blue-100 text-blue-700" },
  envoyee:   { label: "Envoyée",   cls: "bg-indigo-100 text-indigo-700" },
  payee:     { label: "Payée",     cls: "bg-emerald-100 text-emerald-700" },
  en_retard: { label: "En retard", cls: "bg-red-100 text-red-700" },
  annulee:   { label: "Annulée",   cls: "bg-slate-200 text-slate-500" },
};

export const VAT_RATES = [0, 2.1, 5.5, 10, 20] as const;

/** Recalcule les totaux d'une facture à partir de ses lignes. */
export function computeTotals(lines: InvoiceLine[], vatApplicable: boolean) {
  let ht = 0;
  let vat = 0;
  for (const l of lines) {
    const lineHt = (Number(l.qty) || 0) * (Number(l.unit_ht) || 0);
    ht += lineHt;
    if (vatApplicable) vat += lineHt * ((Number(l.vat_rate) || 0) / 100);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { total_ht: round(ht), total_vat: round(vat), total_ttc: round(ht + vat) };
}

export function formatEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
