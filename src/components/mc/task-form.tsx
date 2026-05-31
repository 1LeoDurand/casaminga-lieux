"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks-meta";
import type { Person, Task } from "@/lib/types";

export interface TaskFormValues {
  title: string; description: string; priority: Task["priority"];
  status: Task["status"]; dueDate: string; assigneeId: string; relatedLabel: string;
}
function fromTask(t: Task | null): TaskFormValues {
  return {
    title: t?.title ?? "", description: t?.description ?? "", priority: t?.priority ?? "normale",
    status: t?.status ?? "a_faire", dueDate: t?.due_date ?? "", assigneeId: t?.assignee_id ?? "",
    relatedLabel: t?.related_label ?? "",
  };
}
export function TaskForm({ open, task, persons, busy = false, onSubmit, onClose }: {
  open: boolean; task: Task | null; persons: Person[]; busy?: boolean;
  onSubmit: (v: TaskFormValues) => void; onClose: () => void;
}) {
  const [v, setV] = useState<TaskFormValues>(fromTask(task));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, busy, onClose]);
  if (!open) return null;
  function set<K extends keyof TaskFormValues>(k: K, val: TaskFormValues[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.title.trim()) { setError("Le titre est obligatoire."); return; }
    onSubmit({ ...v, title: v.title.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{task ? "Modifier la tâche" : "Nouvelle tâche"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={v.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Relancer un partenaire, préparer une réunion…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Priorité</label>
              <select className="mc-input" value={v.priority} onChange={(e) => set("priority", e.target.value as Task["priority"])}>
                {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select></div>
            <div className="mc-form-group"><label className="mc-form-label">Statut</label>
              <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as Task["status"])}>
                {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Échéance</label>
              <input className="mc-input" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
            <div className="mc-form-group"><label className="mc-form-label">Assigné·e</label>
              <select className="mc-input" value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
                <option value="">— Personne —</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Module lié (libellé)</label>
            <input className="mc-input" value={v.relatedLabel} onChange={(e) => set("relatedLabel", e.target.value)} placeholder="Finances, Événements, Gouvernance…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Description</label>
            <textarea className="mc-textarea" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Détails de la tâche…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : task ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}
