import type { SpaceStatus, SpaceType } from "@/lib/types";

/** Types d'espace + libellés et teinte de badge (mc-badge-*). */
export const SPACE_TYPES: {
  value: SpaceType;
  label: string;
  badge: string;
}[] = [
  { value: "salle", label: "Salle", badge: "mc-badge-lime" },
  { value: "atelier", label: "Atelier", badge: "mc-badge-orange" },
  { value: "bureau", label: "Bureau", badge: "mc-badge-green" },
  { value: "exterieur", label: "Extérieur", badge: "mc-badge-golden" },
  { value: "commun", label: "Espace commun", badge: "mc-badge-gray" },
  { value: "dortoir", label: "Dortoir", badge: "mc-badge-blue" },
  { value: "chambre", label: "Chambre", badge: "mc-badge-purple" },
];

const TYPE_MAP = Object.fromEntries(SPACE_TYPES.map((t) => [t.value, t]));

export function typeLabel(type: string): string {
  return TYPE_MAP[type]?.label ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function typeBadge(type: string): string {
  return TYPE_MAP[type]?.badge ?? "mc-badge-gray";
}

/** Statuts d'espace + libellés et teinte de badge. */
export const SPACE_STATUSES: {
  value: SpaceStatus;
  label: string;
  badge: string;
}[] = [
  { value: "disponible", label: "Disponible", badge: "mc-badge-green" },
  { value: "maintenance", label: "En maintenance", badge: "mc-badge-orange" },
  { value: "masque", label: "Masqué", badge: "mc-badge-gray" },
];

const STATUS_MAP = Object.fromEntries(SPACE_STATUSES.map((s) => [s.value, s]));

export function spaceStatusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? status;
}

export function spaceStatusBadge(status: string): string {
  return STATUS_MAP[status]?.badge ?? "mc-badge-gray";
}

/** Formate un tarif en euros (null → tiret). */
export function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

/** Résumé tarifaire court (h / j / pers.) pour les cartes. */
export function priceSummary(
  hour: number | null,
  day: number | null,
  person: number | null = null,
): string {
  const parts: string[] = [];
  if (hour !== null && hour !== undefined) parts.push(`${formatPrice(hour)}/h`);
  if (day !== null && day !== undefined) parts.push(`${formatPrice(day)}/j`);
  if (person !== null && person !== undefined) parts.push(`${formatPrice(person)}/pers.`);
  return parts.length ? parts.join(" · ") : "Tarif sur demande";
}

export function formatCapacity(capacity: number | null): string {
  if (capacity === null || capacity === undefined) return "—";
  return `${capacity} pers.`;
}

export function formatArea(area: number | null): string {
  if (area === null || area === undefined) return "—";
  return `${area} m²`;
}

/** Initiale(s) d'un espace pour le placeholder de photo. */
export function spaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
