import type { ReservationStatus } from "@/lib/types";

/** Statuts de réservation + libellés et teinte de badge (mc-badge-*). */
export const RESERVATION_STATUSES: {
  value: ReservationStatus;
  label: string;
  badge: string;
}[] = [
  { value: "demandee", label: "Demandée", badge: "mc-badge-orange" },
  { value: "confirmee", label: "Confirmée", badge: "mc-badge-green" },
  { value: "terminee", label: "Terminée", badge: "mc-badge-gray" },
  { value: "annulee", label: "Annulée", badge: "mc-badge-red" },
];

const STATUS_MAP = Object.fromEntries(
  RESERVATION_STATUSES.map((s) => [s.value, s])
);

export function reservationStatusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? status;
}

export function reservationStatusBadge(status: string): string {
  return STATUS_MAP[status]?.badge ?? "mc-badge-gray";
}

/** Ordre des colonnes du kanban (les annulées en dernier). */
export const KANBAN_ORDER: ReservationStatus[] = [
  "demandee",
  "confirmee",
  "terminee",
  "annulee",
];

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dayLongFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Jour court, ex. « lun. 25 mai ». */
export function formatDay(iso: string): string {
  const d = safeDate(iso);
  return d ? dayFmt.format(d) : iso;
}

/** Jour long capitalisé, ex. « Lundi 25 mai 2026 ». */
export function formatDayLong(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  const s = dayLongFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Heure seule, ex. « 14:00 ». */
export function formatTime(iso: string): string {
  const d = safeDate(iso);
  return d ? timeFmt.format(d) : "";
}

/** Plage horaire d'un même jour, ex. « lun. 25 mai · 14:00 – 17:00 ». */
export function formatRange(startIso: string, endIso: string): string {
  const start = safeDate(startIso);
  const end = safeDate(endIso);
  if (!start || !end) return "—";
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${dayFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  }
  return `${dayFmt.format(start)} ${timeFmt.format(start)} → ${dayFmt.format(end)} ${timeFmt.format(end)}`;
}

/** Durée lisible, ex. « 3 h », « 1 h 30 », « 2 j ». */
export function durationLabel(startIso: string, endIso: string): string {
  const start = safeDate(startIso);
  const end = safeDate(endIso);
  if (!start || !end) return "—";
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (mins >= 24 * 60) {
    const days = Math.round((mins / (24 * 60)) * 10) / 10;
    return `${days} j`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** Clé de jour (YYYY-MM-DD, fuseau local) pour le regroupement agenda. */
export function dayKey(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Vrai si l'ISO tombe aujourd'hui (fuseau local). */
export function isToday(iso: string): boolean {
  const d = safeDate(iso);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Format prix (null → tiret). */
export function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

/**
 * Deux créneaux se chevauchent si l'un commence avant la fin de l'autre
 * et finit après le début de l'autre. (Bornes ouvertes : 14–16 et 16–18 OK.)
 */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
