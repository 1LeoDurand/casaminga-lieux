import type { TaskPriority, TaskStatus } from "@/lib/types";

export const TASK_STATUSES: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "a_faire", label: "À faire",  dot: "#a06800" },
  { value: "en_cours", label: "En cours", dot: "#1d4ed8" },
  { value: "fait",     label: "Fait",     dot: "#2f8a4c" },
];
const STAT_MAP = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s]));
export function taskStatusLabel(s: string): string { return STAT_MAP[s]?.label ?? s; }
export function taskStatusDot(s: string): string { return STAT_MAP[s]?.dot ?? "#8a8a8a"; }

export const TASK_PRIORITIES: { value: TaskPriority; label: string; badge: string }[] = [
  { value: "haute",   label: "Haute",   badge: "mc-badge-red" },
  { value: "normale", label: "Normale", badge: "mc-badge-orange" },
  { value: "basse",   label: "Basse",   badge: "mc-badge-gray" },
];
const PRIO_MAP = Object.fromEntries(TASK_PRIORITIES.map((p) => [p.value, p]));
export function priorityLabel(p: string): string { return PRIO_MAP[p]?.label ?? p; }
export function priorityBadge(p: string): string { return PRIO_MAP[p]?.badge ?? "mc-badge-gray"; }

export const TASK_KANBAN: TaskStatus[] = ["a_faire", "en_cours", "fait"];

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
export function formatDue(iso: string | null): string {
  if (!iso) return "Sans échéance";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
/** Vrai si l'échéance est dépassée (et la tâche pas encore faite). */
export function isOverdue(iso: string | null, status: string): boolean {
  if (!iso || status === "fait") return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}
