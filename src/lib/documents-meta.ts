import type { DocumentStatus, DocumentType } from "@/lib/types";

export const DOCUMENT_TYPES: { value: DocumentType; label: string; badge: string; icon: string }[] = [
  { value: "contrat",    label: "Contrat",     badge: "mc-badge-green",  icon: "📄" },
  { value: "devis",      label: "Devis",       badge: "mc-badge-orange", icon: "📋" },
  { value: "facture",    label: "Facture",     badge: "mc-badge-golden", icon: "🧾" },
  { value: "convention", label: "Convention",  badge: "mc-badge-lime",   icon: "📑" },
  { value: "rapport",    label: "Rapport",     badge: "mc-badge-gray",   icon: "📊" },
  { value: "autre",      label: "Autre",       badge: "mc-badge-gray",   icon: "📁" },
];
const TYPE_MAP = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t]));
export function docTypeLabel(t: string): string { return TYPE_MAP[t]?.label ?? t; }
export function docTypeBadge(t: string): string { return TYPE_MAP[t]?.badge ?? "mc-badge-gray"; }

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string; badge: string }[] = [
  { value: "brouillon", label: "Brouillon", badge: "mc-badge-gray" },
  { value: "envoye",    label: "Envoyé",    badge: "mc-badge-orange" },
  { value: "signe",     label: "Signé",     badge: "mc-badge-green" },
  { value: "archive",   label: "Archivé",   badge: "mc-badge-gray" },
];
const STAT_MAP = Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s.value, s]));
export function docStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function docStatusBadge(s: string): string { return STAT_MAP[s]?.badge ?? "mc-badge-gray"; }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export function formatDate(iso: string): string {
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
