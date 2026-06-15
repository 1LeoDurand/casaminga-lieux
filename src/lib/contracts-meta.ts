import type { ContractType, ContractPeriod, ContractStatus } from "@/lib/types";

export const CONTRACT_TYPES: { value: ContractType; label: string; emoji: string }[] = [
  { value: "assurance",   label: "Assurance",      emoji: "🛡️" },
  { value: "bail",        label: "Bail / Loyer",   emoji: "🏠" },
  { value: "convention",  label: "Convention",     emoji: "🤝" },
  { value: "prestation",  label: "Prestation",     emoji: "🔧" },
  { value: "mission",     label: "Mission",        emoji: "📋" },
  { value: "partenariat", label: "Partenariat",    emoji: "🔗" },
  { value: "abonnement",  label: "Abonnement",     emoji: "🔁" },
  { value: "autre",       label: "Autre",          emoji: "📄" },
];

export const CONTRACT_PERIODS: { value: ContractPeriod; label: string }[] = [
  { value: "mensuel", label: "/ mois" },
  { value: "annuel",  label: "/ an" },
  { value: "ponctuel", label: "ponctuel" },
];

export const CONTRACT_STATUSES: { value: ContractStatus; label: string; badge: string }[] = [
  { value: "brouillon",      label: "Brouillon",      badge: "mc-badge-gray" },
  { value: "en_negociation", label: "En négociation", badge: "mc-badge-orange" },
  { value: "actif",          label: "Actif",          badge: "mc-badge-lime" },
  { value: "expire",         label: "Expiré",         badge: "mc-badge-gray" },
  { value: "resilie",        label: "Résilié",        badge: "mc-badge-gray" },
];

export function contractTypeLabel(t: string | null): string {
  if (!t) return "—";
  return CONTRACT_TYPES.find((x) => x.value === t)?.label ?? t;
}
export function contractTypeEmoji(t: string | null): string {
  if (!t) return "📄";
  return CONTRACT_TYPES.find((x) => x.value === t)?.emoji ?? "📄";
}
export function contractStatusLabel(s: string | null): string {
  if (!s) return "—";
  return CONTRACT_STATUSES.find((x) => x.value === s)?.label ?? s;
}
export function contractStatusBadge(s: string | null): string {
  return CONTRACT_STATUSES.find((x) => x.value === s)?.badge ?? "mc-badge-gray";
}
export function periodLabel(p: string | null): string {
  return CONTRACT_PERIODS.find((x) => x.value === p)?.label ?? "";
}

export function fmtEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Coût annualisé (mensuel ×12, annuel ×1, ponctuel 0 pour les charges récurrentes). */
export function annualCost(amount: number | null, period: string): number {
  if (!amount) return 0;
  if (period === "mensuel") return amount * 12;
  if (period === "annuel") return amount;
  return 0;
}

/**
 * Date d'alerte = renouvellement − préavis (sinon le renouvellement, sinon la fin).
 * Renvoie le nombre de jours avant l'échéance (négatif si dépassée), ou null.
 */
export function daysUntilDeadline(c: {
  renewal_date: string | null;
  end_date: string | null;
  notice_period_days: number | null;
}): number | null {
  const base = c.renewal_date ?? c.end_date;
  if (!base) return null;
  const d = new Date(base);
  if (c.notice_period_days) d.setDate(d.getDate() - c.notice_period_days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
