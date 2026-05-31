import type { ImpactCategory } from "@/lib/types";

export const IMPACT_CATEGORIES: { value: ImpactCategory; label: string; badge: string; color: string }[] = [
  { value: "frequentation", label: "Fréquentation", badge: "mc-badge-green",  color: "#2f8a4c" },
  { value: "diversite",     label: "Diversité",     badge: "mc-badge-golden", color: "#a06800" },
  { value: "environnement", label: "Environnement", badge: "mc-badge-lime",   color: "#2f8a4c" },
  { value: "economie",      label: "Économie",      badge: "mc-badge-orange", color: "#c2452f" },
  { value: "autre",         label: "Autre",         badge: "mc-badge-gray",   color: "#8a8a8a" },
];
const CAT_MAP = Object.fromEntries(IMPACT_CATEGORIES.map((c) => [c.value, c]));
export function impactCategoryLabel(c: string): string { return CAT_MAP[c]?.label ?? c; }
export function impactCategoryBadge(c: string): string { return CAT_MAP[c]?.badge ?? "mc-badge-gray"; }
export function impactCategoryColor(c: string): string { return CAT_MAP[c]?.color ?? "#8a8a8a"; }

export function formatIndicator(value: number, unit: string | null): string {
  const n = Number(value);
  const formatted = Number.isInteger(n) ? n.toLocaleString("fr-FR") : n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}
