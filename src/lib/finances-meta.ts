export const TRANSACTION_CATEGORIES_RECETTE = [
  { value: "location",     label: "Location" },
  { value: "cotisation",   label: "Cotisation / résidence" },
  { value: "prestation",   label: "Prestation / atelier" },
  { value: "subvention",   label: "Subvention" },
  { value: "autre",        label: "Autre recette" },
];
export const TRANSACTION_CATEGORIES_DEPENSE = [
  { value: "loyer",        label: "Loyer" },
  { value: "salaire",      label: "Salaire / prestation" },
  { value: "achat",        label: "Achat / matériel" },
  { value: "autre",        label: "Autre dépense" },
];
export const ALL_CATEGORIES = [
  ...TRANSACTION_CATEGORIES_RECETTE,
  ...TRANSACTION_CATEGORIES_DEPENSE.filter((c) => !TRANSACTION_CATEGORIES_RECETTE.find((r) => r.value === c.value)),
];

export function categoryLabel(cat: string): string {
  return ALL_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export const TRANSACTION_STATUSES = [
  { value: "en_attente", label: "En attente", badge: "mc-badge-orange" },
  { value: "validee",    label: "Validée",    badge: "mc-badge-green" },
  { value: "annulee",    label: "Annulée",    badge: "mc-badge-red" },
];
const STAT_MAP = Object.fromEntries(TRANSACTION_STATUSES.map((s) => [s.value, s]));
export function txStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function txStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

const euroFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export function formatAmount(n: number): string { return euroFmt.format(n); }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export function formatDate(iso: string): string {
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

/** Retourne le mois YYYY-MM à partir d'une date ISO. */
export function monthKey(dateStr: string): string { return dateStr.slice(0, 7); }

export interface MonthSummary {
  month: string; label: string; recettes: number; depenses: number;
}
export function buildMonthSummaries(transactions: { type: string; amount: number; date: string; status: string }[]): MonthSummary[] {
  const map = new Map<string, { recettes: number; depenses: number }>();
  for (const t of transactions) {
    if (t.status === "annulee") continue;
    const k = monthKey(t.date);
    const entry = map.get(k) ?? { recettes: 0, depenses: 0 };
    if (t.type === "recette") entry.recettes += Number(t.amount);
    else entry.depenses += Number(t.amount);
    map.set(k, entry);
  }
  const months = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const mFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
  return months.map(([k, v]) => ({
    month: k, label: mFmt.format(new Date(`${k}-01`)), ...v,
  }));
}
