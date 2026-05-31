import type { EvenementStatus, EvenementType } from "@/lib/types";

export const EVENT_TYPES: { value: EvenementType; label: string; badge: string }[] = [
  { value: "atelier",    label: "Atelier",      badge: "mc-badge-lime" },
  { value: "concert",    label: "Concert",      badge: "mc-badge-golden" },
  { value: "exposition", label: "Exposition",   badge: "mc-badge-orange" },
  { value: "conference", label: "Conférence",   badge: "mc-badge-green" },
  { value: "marche",     label: "Marché",       badge: "mc-badge-lime" },
  { value: "autre",      label: "Autre",        badge: "mc-badge-gray" },
];

const TYPE_MAP = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t]));
export function eventTypeLabel(type: string): string {
  return TYPE_MAP[type]?.label ?? type;
}
export function eventTypeBadge(type: string): string {
  return TYPE_MAP[type]?.badge ?? "mc-badge-gray";
}

export const EVENT_STATUSES: { value: EvenementStatus; label: string; badge: string }[] = [
  { value: "brouillon", label: "Brouillon", badge: "mc-badge-gray" },
  { value: "publie",    label: "Publié",    badge: "mc-badge-green" },
  { value: "annule",    label: "Annulé",    badge: "mc-badge-red" },
];

const STATUS_MAP = Object.fromEntries(EVENT_STATUSES.map((s) => [s.value, s]));
export function eventStatusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? status;
}
export function eventStatusBadge(status: string): string {
  return STATUS_MAP[status]?.badge ?? "mc-badge-gray";
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const dayLongFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eventDayShort(iso: string): string {
  const d = safeDate(iso);
  return d ? dayFmt.format(d) : iso;
}
export function eventDayLong(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  const s = dayLongFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function eventTime(iso: string): string {
  const d = safeDate(iso);
  return d ? timeFmt.format(d) : "";
}
export function eventRange(startIso: string, endIso: string): string {
  const s = safeDate(startIso);
  const e = safeDate(endIso);
  if (!s || !e) return "—";
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${dayFmt.format(s)} · ${timeFmt.format(s)} – ${timeFmt.format(e)}`
    : `${dayFmt.format(s)} → ${dayFmt.format(e)}`;
}

export function eventDayKey(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isFuture(iso: string): boolean {
  return new Date(iso) > new Date();
}
export function isThisWeek(iso: string): boolean {
  const d = safeDate(iso);
  if (!d) return false;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

export function eventInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatEventPrice(price: number | null): string {
  if (price === null) return "Entrée libre";
  if (price === 0) return "Entrée libre";
  return `${price} €`;
}
export function formatCapacity(cap: number | null): string {
  return cap !== null ? `${cap} pers. max` : "Capacité libre";
}
