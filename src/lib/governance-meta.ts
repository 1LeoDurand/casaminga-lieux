import type { MeetingStatus, MeetingType } from "@/lib/types";

export const MEETING_TYPES: { value: MeetingType; label: string; badge: string }[] = [
  { value: "ca",     label: "Conseil d'administration", badge: "mc-badge-green" },
  { value: "ag",     label: "Assemblée générale",       badge: "mc-badge-golden" },
  { value: "bureau", label: "Bureau",                   badge: "mc-badge-lime" },
  { value: "autre",  label: "Autre",                    badge: "mc-badge-gray" },
];
const TYPE_MAP = Object.fromEntries(MEETING_TYPES.map((t) => [t.value, t]));
export function meetingTypeLabel(t: string): string { return TYPE_MAP[t]?.label ?? t; }
export function meetingTypeShort(t: string): string {
  return ({ ca: "CA", ag: "AG", bureau: "Bureau", autre: "Autre" } as Record<string, string>)[t] ?? t;
}
export function meetingTypeBadge(t: string): string { return TYPE_MAP[t]?.badge ?? "mc-badge-gray"; }

export const MEETING_STATUSES: { value: MeetingStatus; label: string; badge: string }[] = [
  { value: "planifiee", label: "Planifiée", badge: "mc-badge-orange" },
  { value: "tenue",     label: "Tenue",     badge: "mc-badge-green" },
  { value: "annulee",   label: "Annulée",   badge: "mc-badge-red" },
];
const STAT_MAP = Object.fromEntries(MEETING_STATUSES.map((s) => [s.value, s]));
export function meetingStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function meetingStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export function formatDateLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : shortFmt.format(d);
}
export function mandatePeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "Période non définie";
  return `${formatDateShort(start)} → ${formatDateShort(end)}`;
}
