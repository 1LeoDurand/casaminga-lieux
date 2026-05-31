import type { CommunityStatus, CommunityType } from "@/lib/types";

export const COMMUNITY_TYPES: { value: CommunityType; label: string; badge: string }[] = [
  { value: "offre",    label: "Offre",    badge: "mc-badge-green" },
  { value: "demande",  label: "Demande",  badge: "mc-badge-orange" },
  { value: "entraide", label: "Entraide", badge: "mc-badge-lime" },
  { value: "info",     label: "Info",     badge: "mc-badge-gray" },
];
const TYPE_MAP = Object.fromEntries(COMMUNITY_TYPES.map((t) => [t.value, t]));
export function communityTypeLabel(t: string): string { return TYPE_MAP[t]?.label ?? t; }
export function communityTypeBadge(t: string): string { return TYPE_MAP[t]?.badge ?? "mc-badge-gray"; }

export const COMMUNITY_STATUSES: { value: CommunityStatus; label: string; badge: string }[] = [
  { value: "actif",   label: "Actif",   badge: "mc-badge-green" },
  { value: "resolu",  label: "Résolu",  badge: "mc-badge-gray" },
  { value: "archive", label: "Archivé", badge: "mc-badge-gray" },
];
const STAT_MAP = Object.fromEntries(COMMUNITY_STATUSES.map((s) => [s.value, s]));
export function communityStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function communityStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export function formatDate(iso: string): string {
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
