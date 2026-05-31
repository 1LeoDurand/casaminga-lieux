import type { AutomationAction, AutomationTrigger } from "@/lib/types";

export const AUTOMATION_TRIGGERS: { value: AutomationTrigger; label: string; badge: string }[] = [
  { value: "demande_recue",    label: "Demande reçue",       badge: "mc-badge-orange" },
  { value: "resa_creee",       label: "Réservation créée",   badge: "mc-badge-green" },
  { value: "facture_impayee",  label: "Facture impayée",     badge: "mc-badge-red" },
  { value: "evenement_proche", label: "Événement proche",    badge: "mc-badge-golden" },
  { value: "manuel",           label: "Déclenchement manuel", badge: "mc-badge-gray" },
];
const TRIG_MAP = Object.fromEntries(AUTOMATION_TRIGGERS.map((t) => [t.value, t]));
export function triggerLabel(t: string): string { return TRIG_MAP[t]?.label ?? t; }
export function triggerBadge(t: string): string { return TRIG_MAP[t]?.badge ?? "mc-badge-gray"; }

export const AUTOMATION_ACTIONS: { value: AutomationAction; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "email",        label: "Email" },
  { value: "tache",        label: "Créer une tâche" },
  { value: "statut",       label: "Changer un statut" },
];
const ACT_MAP = Object.fromEntries(AUTOMATION_ACTIONS.map((a) => [a.value, a]));
export function actionLabel(a: string): string { return ACT_MAP[a]?.label ?? a; }

const dtFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export function formatLastRun(iso: string | null): string {
  if (!iso) return "Jamais exécutée";
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : `Dernière : ${dtFmt.format(d)}`;
}
