import type { ResidenceDiscipline, ResidenceStatus } from "@/lib/types";

export const RESIDENCE_DISCIPLINES: { value: ResidenceDiscipline; label: string; badge: string }[] = [
  { value: "ceramique",   label: "Céramique",   badge: "mc-badge-orange" },
  { value: "peinture",    label: "Peinture",    badge: "mc-badge-golden" },
  { value: "musique",     label: "Musique",     badge: "mc-badge-lime" },
  { value: "danse",       label: "Danse",       badge: "mc-badge-lime" },
  { value: "theatre",     label: "Théâtre",     badge: "mc-badge-green" },
  { value: "litterature", label: "Littérature", badge: "mc-badge-gray" },
  { value: "numerique",   label: "Numérique",   badge: "mc-badge-green" },
  { value: "autre",       label: "Autre",       badge: "mc-badge-gray" },
];

const DISC_MAP = Object.fromEntries(RESIDENCE_DISCIPLINES.map((d) => [d.value, d]));
export function disciplineLabel(d: string): string { return DISC_MAP[d]?.label ?? d; }
export function disciplineBadge(d: string): string { return DISC_MAP[d]?.badge ?? "mc-badge-gray"; }

export const RESIDENCE_STATUSES: { value: ResidenceStatus; label: string; badge: string }[] = [
  { value: "candidature", label: "Candidature", badge: "mc-badge-gray" },
  { value: "acceptee",    label: "Acceptée",    badge: "mc-badge-lime" },
  { value: "en_cours",    label: "En cours",    badge: "mc-badge-green" },
  { value: "terminee",    label: "Terminée",    badge: "mc-badge-gray" },
  { value: "refusee",     label: "Refusée",     badge: "mc-badge-red" },
];

const STAT_MAP = Object.fromEntries(RESIDENCE_STATUSES.map((s) => [s.value, s]));
export function residenceStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function residenceStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function safeDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function formatDate(iso: string | null): string {
  const d = safeDate(iso); return d ? dateFmt.format(d) : "—";
}
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates à définir";
  if (start && end) return `${formatDate(start)} → ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  return `Jusqu'au ${formatDate(end)}`;
}
export function durationDays(start: string | null, end: string | null): string {
  const s = safeDate(start); const e = safeDate(end);
  if (!s || !e) return "";
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
  return `${days} jour${days > 1 ? "s" : ""}`;
}
export function residenceInitials(title: string): string {
  const parts = title.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
