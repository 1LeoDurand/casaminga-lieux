import type { AssetCategory, AssetStatus, AssetCondition, MaintenanceStatus } from "@/lib/types";

export const ASSET_CATEGORIES: { value: AssetCategory; label: string; emoji: string }[] = [
  { value: "mobilier",     label: "Mobilier",        emoji: "🪑" },
  { value: "informatique", label: "Informatique",    emoji: "💻" },
  { value: "son",          label: "Son",             emoji: "🔊" },
  { value: "lumiere",      label: "Lumière",         emoji: "💡" },
  { value: "cuisine",      label: "Cuisine",         emoji: "🍳" },
  { value: "outillage",    label: "Outillage",       emoji: "🔧" },
  { value: "autre",        label: "Autre",           emoji: "📦" },
];

export const ASSET_STATUSES: { value: AssetStatus; label: string; badge: string }[] = [
  { value: "disponible",  label: "Disponible",   badge: "mc-badge-lime" },
  { value: "en_pret",     label: "En prêt",      badge: "mc-badge-orange" },
  { value: "en_panne",    label: "En panne",     badge: "mc-badge-red" },
  { value: "maintenance", label: "Maintenance",  badge: "mc-badge-orange" },
  { value: "reforme",     label: "Réformé",      badge: "mc-badge-gray" },
];

export const ASSET_CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: "neuf", label: "Neuf" },
  { value: "bon",  label: "Bon état" },
  { value: "use",  label: "Usé" },
  { value: "hs",   label: "Hors service" },
];

export const MAINTENANCE_STATUSES: { value: MaintenanceStatus; label: string; dot: string }[] = [
  { value: "a_faire",  label: "À faire",  dot: "#a06800" },
  { value: "en_cours", label: "En cours", dot: "#1d4ed8" },
  { value: "fait",     label: "Fait",     dot: "#2f8a4c" },
];

export function categoryLabel(c: string | null): string {
  if (!c) return "—";
  return ASSET_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}
export function categoryEmoji(c: string | null): string {
  if (!c) return "📦";
  return ASSET_CATEGORIES.find((x) => x.value === c)?.emoji ?? "📦";
}
export function assetStatusLabel(s: string | null): string {
  if (!s) return "—";
  return ASSET_STATUSES.find((x) => x.value === s)?.label ?? s;
}
export function assetStatusBadge(s: string | null): string {
  return ASSET_STATUSES.find((x) => x.value === s)?.badge ?? "mc-badge-gray";
}
export function conditionLabel(c: string | null): string {
  if (!c) return "—";
  return ASSET_CONDITIONS.find((x) => x.value === c)?.label ?? c;
}

export function fmtEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Jours avant expiration de garantie (négatif si expirée), ou null. */
export function daysUntilWarranty(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
