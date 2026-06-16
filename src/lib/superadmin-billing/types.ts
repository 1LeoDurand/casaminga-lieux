/** Types du module Facturation superadmin (ecommunication / Léo Durand EI).
 *  Purs — importables côté serveur ET client.
 *  Réutilise les briques de calcul du module Facturation asso. */

import { type InvoiceLine, computeTotals, formatEuros } from "@/lib/invoicing/types";

export { computeTotals, formatEuros };
export type { InvoiceLine };

export type SaInvoiceStatus = "brouillon" | "emise" | "envoyee" | "payee" | "annulee";
export type SaPaymentMethod = "virement" | "cheque" | "cash" | "carte";

export const SA_PAYMENT_METHODS: { value: SaPaymentMethod; label: string }[] = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "cash", label: "Espèces" },
  { value: "carte", label: "Carte" },
];

export const SA_STATUS_META: Record<SaInvoiceStatus, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-slate-100 text-slate-600" },
  emise:     { label: "Émise",     cls: "bg-blue-100 text-blue-700" },
  envoyee:   { label: "Envoyée",   cls: "bg-indigo-100 text-indigo-700" },
  payee:     { label: "Payée",     cls: "bg-emerald-100 text-emerald-700" },
  annulee:   { label: "Annulée",   cls: "bg-slate-200 text-slate-500" },
};

export interface SaInvoiceSettings {
  id: number;
  issuer_name: string | null;
  issuer_address: string | null;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  payment_terms_days: number;
  late_penalty: string | null;
  accent_color: string;
  footer_mentions: string | null;
  number_prefix: string;
  number_start: number;
  vat_applicable: boolean;
  updated_at: string;
}

export interface SaClient {
  id: string;
  organization_id: string | null;
  name: string;
  email: string | null;
  address: string | null;
  siret: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaPricingItem {
  id: string;
  label: string;
  description: string | null;
  unit_ht: number;
  vat_rate: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SaInvoice {
  id: string;
  number: string | null;
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
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  notes: string | null;
  payment_method: SaPaymentMethod | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SA_SETTINGS: SaInvoiceSettings = {
  id: 1,
  issuer_name: "Léo Durand EI — ecommunication",
  issuer_address: "14 rue des Fontaines, 34800 Salasc",
  siret: "82443037500025",
  vat_number: null,
  email: "ecommunication@etik.com",
  phone: "0652116119",
  iban: "FR76 10278 09113 00021412101 50",
  bic: "CMCIFR2A",
  bank_name: "Crédit Mutuel",
  payment_terms_days: 30,
  late_penalty: null,
  accent_color: "#FF8A65",
  footer_mentions: "TVA non applicable, article 293 B du code général des impôts.",
  number_prefix: "DND-",
  number_start: 1,
  vat_applicable: false,
  updated_at: new Date().toISOString(),
};
