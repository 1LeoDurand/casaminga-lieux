import type { RequestPriority, RequestStatus, RequestType } from "@/lib/types";

/** Types de demande proposés au formulaire public + libellés d'affichage. */
export const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "contact", label: "Contact" },
  { value: "residence", label: "Résidence" },
  { value: "coworking", label: "Coworking" },
  { value: "reservation", label: "Réservation d'espace" },
  { value: "evenement", label: "Événement" },
  { value: "partenariat", label: "Partenariat" },
  { value: "benevolat", label: "Bénévolat" },
  { value: "presse", label: "Presse" },
  { value: "autre", label: "Autre" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  REQUEST_TYPES.map((t) => [t.value, t.label])
);

export function requestTypeLabel(type: string | null): string {
  if (!type) return "Demande";
  return TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/** Statuts ouverts à la sélection manuelle dans le dashboard. */
export const SELECTABLE_STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "nouvelle", label: "Nouvelle" },
  { value: "etudier", label: "À étudier" },
  { value: "attente", label: "En attente" },
  { value: "validee", label: "Validée" },
  { value: "refusee", label: "Refusée" },
];

/** Tous les statuts (chips de filtre), inclut l'archivage. */
export const ALL_STATUSES: { value: RequestStatus; label: string }[] = [
  ...SELECTABLE_STATUSES,
  { value: "archivee", label: "Archivée" },
];

/** Statuts considérés « ouverts » (à traiter). */
export const OPEN_STATUSES: RequestStatus[] = ["nouvelle", "etudier", "attente"];

/** Priorités (chips de filtre). */
export const PRIORITIES: { value: RequestPriority; label: string }[] = [
  { value: "haute", label: "Haute" },
  { value: "normale", label: "Normale" },
  { value: "basse", label: "Basse" },
];

export const PRIORITY_META: Record<
  RequestPriority,
  { label: string; className: string }
> = {
  haute: { label: "Haute", className: "bg-coral/20 text-coral-dark" },
  normale: { label: "Normale", className: "bg-muted text-warmgray" },
  basse: { label: "Basse", className: "bg-mint/20 text-[#15803d]" },
};

export function priorityMeta(priority: string) {
  return PRIORITY_META[priority as RequestPriority] ?? PRIORITY_META.normale;
}
