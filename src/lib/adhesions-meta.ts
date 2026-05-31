import type { MembershipApplicationStatus, MembershipCampaignStatus } from "@/lib/types";

export const CAMPAIGN_STATUSES: { value: MembershipCampaignStatus; label: string; badge: string }[] = [
  { value: "publie",    label: "Public",    badge: "mc-badge-green" },
  { value: "prive",     label: "Privé",     badge: "mc-badge-orange" },
  { value: "brouillon", label: "Brouillon", badge: "mc-badge-gray" },
  { value: "archive",   label: "Archivé",   badge: "mc-badge-gray" },
];
const CS_MAP = Object.fromEntries(CAMPAIGN_STATUSES.map((s) => [s.value, s]));
export function campaignStatusLabel(s: string): string { return CS_MAP[s]?.label ?? s; }
export function campaignStatusBadge(s: string): string { return CS_MAP[s]?.badge ?? "mc-badge-gray"; }

export const APPLICATION_STATUSES: { value: MembershipApplicationStatus; label: string; badge: string }[] = [
  { value: "en_attente", label: "En attente", badge: "mc-badge-orange" },
  { value: "confirmee",  label: "Confirmée",  badge: "mc-badge-green" },
  { value: "annulee",    label: "Annulée",    badge: "mc-badge-red" },
];
const AS_MAP = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s.value, s]));
export function appStatusLabel(s: string): string { return AS_MAP[s]?.label ?? s; }
export function appStatusBadge(s: string): string { return AS_MAP[s]?.badge ?? "mc-badge-gray"; }

export const PERIOD_TYPES = [
  { value: "annee_glissante", label: "Année glissante (1 an à partir de l'adhésion)" },
  { value: "illimitee",       label: "Illimitée" },
  { value: "personnalisee",   label: "Personnalisée (dates fixes)" },
];

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function safeDate(iso: string | null): Date | null {
  if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d;
}
export function formatDate(iso: string | null): string {
  const d = safeDate(iso); return d ? dateFmt.format(d) : "—";
}
export function formatAmount(n: number): string {
  const v = Number(n);
  return Number.isInteger(v) ? `${v} €` : `${v.toFixed(2)} €`;
}
export function computeMembershipEnd(periodType: string, start: string, periodEnd: string | null): string | null {
  if (periodType === "illimitee") return null;
  if (periodType === "personnalisee") return periodEnd;
  // annee_glissante: +1 an
  const d = safeDate(start); if (!d) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
export function slugify(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
