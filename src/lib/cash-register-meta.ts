// ════════════════════════════════════════════════════════════
//  Caisse certifiée — métadonnées & helpers (loi anti-fraude TVA / NF525)
// ════════════════════════════════════════════════════════════
import type { CashPaymentMethod, CashSource, CashClosureType } from "@/lib/types";

export const PAYMENT_METHODS: { value: CashPaymentMethod; label: string }[] = [
  { value: "especes",   label: "Espèces" },
  { value: "cb",        label: "Carte bancaire" },
  { value: "cheque",    label: "Chèque" },
  { value: "virement",  label: "Virement" },
  { value: "helloasso", label: "HelloAsso" },
  { value: "autre",     label: "Autre" },
];

export const CASH_SOURCES: { value: CashSource; label: string }[] = [
  { value: "adhesion",    label: "Adhésion / cotisation" },
  { value: "billetterie", label: "Billetterie" },
  { value: "buvette",     label: "Buvette / bar" },
  { value: "don",         label: "Don" },
  { value: "boutique",    label: "Boutique" },
  { value: "autre",       label: "Autre" },
];

// Taux de TVA en vigueur (France). 0 = non assujetti (cas fréquent des assos).
export const VAT_RATES: { value: number; label: string }[] = [
  { value: 0,    label: "0 % (non assujetti / exonéré)" },
  { value: 2.1,  label: "2,1 %" },
  { value: 5.5,  label: "5,5 %" },
  { value: 10,   label: "10 %" },
  { value: 20,   label: "20 %" },
];

export const CLOSURE_TYPES: { value: CashClosureType; label: string; desc: string }[] = [
  { value: "jour",  label: "Clôture journalière (Z)", desc: "Arrêté de la journée" },
  { value: "mois",  label: "Clôture mensuelle",       desc: "Arrêté du mois" },
  { value: "annee", label: "Clôture annuelle",        desc: "Arrêté de l'exercice" },
];

const PM = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));
const SRC = Object.fromEntries(CASH_SOURCES.map((m) => [m.value, m.label]));

export function paymentLabel(v: string): string { return PM[v] ?? v; }
export function sourceLabel(v: string): string { return SRC[v] ?? v; }
export function closureTypeLabel(v: string): string {
  return CLOSURE_TYPES.find((c) => c.value === v)?.label ?? v;
}

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
export function fmtEuro(n: number): string { return euro.format(Number(n) || 0); }

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Empreinte courte d'un hash pour affichage (piste d'audit). */
export function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  return h.length <= 12 ? h : `${h.slice(0, 8)}…${h.slice(-4)}`;
}

/** Calcule HT/TVA à partir d'un montant TTC et d'un taux (aperçu côté client). */
export function splitVat(amountTtc: number, rate: number): { ht: number; vat: number } {
  const ht = Math.round((amountTtc / (1 + rate / 100)) * 100) / 100;
  return { ht, vat: Math.round((amountTtc - ht) * 100) / 100 };
}
