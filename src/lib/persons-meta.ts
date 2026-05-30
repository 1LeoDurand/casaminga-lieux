import type { PersonRole, PersonStatus } from "@/lib/types";

/** Rôles d'une personne (CRM) + libellés et teinte de badge. */
export const PERSON_ROLES: {
  value: PersonRole;
  label: string;
  badge: string; // teinte mc-badge-*
}[] = [
  { value: "membre", label: "Membre", badge: "mc-badge-lime" },
  { value: "coworker", label: "Coworker", badge: "mc-badge-green" },
  { value: "benevole", label: "Bénévole", badge: "mc-badge-green" },
  { value: "intervenant", label: "Intervenant·e", badge: "mc-badge-orange" },
  { value: "resident", label: "Résident·e", badge: "mc-badge-golden" },
  { value: "partenaire", label: "Partenaire", badge: "mc-badge-gray" },
  { value: "equipe", label: "Équipe", badge: "mc-badge-lime" },
  { value: "prospect", label: "Prospect", badge: "mc-badge-gray" },
];

const ROLE_MAP = Object.fromEntries(PERSON_ROLES.map((r) => [r.value, r]));

export function roleLabel(role: string): string {
  return ROLE_MAP[role]?.label ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleBadge(role: string): string {
  return ROLE_MAP[role]?.badge ?? "mc-badge-gray";
}

export const PERSON_STATUSES: { value: PersonStatus; label: string }[] = [
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
];

export function statusLabel(status: string): string {
  return status === "inactif" ? "Inactif" : "Actif";
}

/** Initiales (max 2 lettres) à partir d'un nom. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Couleur d'avatar déterministe (dérivée du nom) — palette Casa Minga. */
const AVATAR_COLORS = ["#ff8a65", "#e8714d", "#0a6b78", "#6b3aa0", "#2f8a4c", "#a06800", "#1d4ed8"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
