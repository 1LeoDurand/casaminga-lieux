import type { ExpenseCategory } from "@/lib/types";
import { PAYMENT_METHODS } from "@/lib/invoicing/types";

export { PAYMENT_METHODS };

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: "loyer",          label: "Loyer / Charges",    emoji: "🏠" },
  { value: "fournitures",    label: "Fournitures",         emoji: "📦" },
  { value: "salaires",       label: "Salaires / RH",       emoji: "👥" },
  { value: "services",       label: "Services / Prestataires", emoji: "🔧" },
  { value: "deplacement",    label: "Déplacements",        emoji: "🚗" },
  { value: "communication",  label: "Communication",       emoji: "📣" },
  { value: "materiel",       label: "Matériel / Équipement", emoji: "🖥️" },
  { value: "autre",          label: "Autre",               emoji: "📄" },
];

export function categoryLabel(cat: string | null): string {
  if (!cat) return "—";
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}
export function categoryEmoji(cat: string | null): string {
  if (!cat) return "📄";
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.emoji ?? "📄";
}

export function paymentLabel(pm: string | null): string {
  if (!pm) return "—";
  const m = PAYMENT_METHODS.find((x) => x.value === pm);
  return m ? `${m.emoji} ${m.label}` : pm;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
