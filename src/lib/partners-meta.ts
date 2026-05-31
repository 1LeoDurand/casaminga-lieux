import type { PartnerStatus, PartnerType } from "@/lib/types";

export const PARTNER_TYPES: { value: PartnerType; label: string; badge: string }[] = [
  { value: "public",     label: "Public",     badge: "mc-badge-green" },
  { value: "prive",      label: "Privé",      badge: "mc-badge-golden" },
  { value: "associatif", label: "Associatif", badge: "mc-badge-lime" },
  { value: "fondation",  label: "Fondation",  badge: "mc-badge-orange" },
  { value: "autre",      label: "Autre",      badge: "mc-badge-gray" },
];
const TYPE_MAP = Object.fromEntries(PARTNER_TYPES.map((t) => [t.value, t]));
export function partnerTypeLabel(t: string): string { return TYPE_MAP[t]?.label ?? t; }
export function partnerTypeBadge(t: string): string { return TYPE_MAP[t]?.badge ?? "mc-badge-gray"; }

export const PARTNER_STATUSES: { value: PartnerStatus; label: string; badge: string }[] = [
  { value: "actif",    label: "Actif",    badge: "mc-badge-green" },
  { value: "prospect", label: "Prospect", badge: "mc-badge-orange" },
  { value: "inactif",  label: "Inactif",  badge: "mc-badge-gray" },
];
const STAT_MAP = Object.fromEntries(PARTNER_STATUSES.map((s) => [s.value, s]));
export function partnerStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function partnerStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

export function partnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
