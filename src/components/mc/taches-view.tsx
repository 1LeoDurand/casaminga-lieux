"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, ListTodo, Calendar, User, AlertTriangle, Check, Mail, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { TaskForm, type TaskFormValues } from "@/components/mc/task-form";
import {
  TASK_PRIORITIES, TASK_KANBAN, taskStatusLabel, taskStatusDot,
  priorityLabel, priorityBadge, formatDue, isOverdue,
} from "@/lib/tasks-meta";
import { createTaskAction, deleteTaskAction, updateTaskAction, notifyAssigneeAction, remindAssigneeAction } from "@/app/(admin)/dashboard/[org]/taches/actions";
import type { Person, Task, TaskStatus } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
function PrioBadge({ p }: { p: string }) { return <span className={`mc-badge ${priorityBadge(p)}`}>{priorityLabel(p)}</span>; }

function TaskCard({ t, personName, onSelect }: {
  t: Task;
  personName: (id: string | null) => string | null;
  onSelect: (id: string) => void;
}) {
  const overdue = isOverdue(t.due_date, t.status);
  return (
    <button type="button" className={`mc-resa-card ${t.status === "fait" ? "is-annulee" : ""}`} onClick={() => onSelect(t.id)}>
      <div className="flex items-start justify-between gap-2">
        <span className="mc-resa-title">{t.title}</span>
        <PrioBadge p={t.priority} />
      </div>
      <div className="mc-resa-line">
        <Calendar className="size-3.5" />
        <span className={overdue ? "font-semibold text-coral-dark" : ""}>{formatDue(t.due_date)}</span>
        {overdue ? <AlertTriangle className="size-3 text-coral-dark" /> : null}
      </div>
      {personName(t.assignee_id) ? <div className="mc-resa-line"><User className="size-3.5" /> {personName(t.assignee_id)}</div> : null}
      {t.related_label ? <span className="mc-tag">{t.related_label}</span> : null}
    </button>
  );
}

export function TachesView({ tasks, persons, orgSlug, orgId }: {
  tasks: Task[]; persons: Person[]; orgSlug: string; orgId: string;
}) {
  const [prioF, setPrioF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const personName = (id: string | null) => id ? personById.get(id)?.name ?? null : null;
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: tasks.length,
    aFaire: tasks.filter((t) => t.status === "a_faire").length,
    enCours: tasks.filter((t) => t.status === "en_cours").length,
    enRetard: tasks.filter((t) => isOverdue(t.due_date, t.status)).length,
    faites: tasks.filter((t) => t.status === "fait").length,
  }), [tasks]);

  const filtered = useMemo(() =>
    tasks.filter((t) => prioF.size === 0 || prioF.has(t.priority)),
    [tasks, prioF]);

  const byStatus = useMemo(() => {
    const m: Record<TaskStatus, Task[]> = { a_faire: [], en_cours: [], fait: [] };
    for (const t of filtered) m[t.status]?.push(t);
    return m;
  }, [filtered]);

  function submitForm(values: TaskFormValues) {
    const payload = {
      title: values.title, description: values.description.trim() || null,
      priority: values.priority, status: values.status,
      due_date: values.dueDate || null, assignee_id: values.assigneeId || null,
      related_label: values.relatedLabel.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateTaskAction(orgSlug, editing.id, payload)
        : await createTaskAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Tâche mise à jour" : "Tâche créée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible. Réessayez.");
    });
  }
  function quickStatus(t: Task, status: TaskStatus) {
    startTransition(async () => {
      const res = await updateTaskAction(orgSlug, t.id, { status });
      if (res.ok) toast.success(`Tâche : ${taskStatusLabel(status).toLowerCase()}`);
      else toast.error("Action impossible.");
    });
  }
  function doDelete(t: Task) {
    startTransition(async () => {
      const { ok } = await deleteTaskAction(orgSlug, t.id);
      if (ok) { toast.success("Tâche supprimée"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }
  function notifyAssignee(t: Task) {
    startTransition(async () => {
      const res = await notifyAssigneeAction(orgSlug, t.id);
      if (res.ok) toast.success("Email d'assignation envoyé ✓");
      else toast.error(res.error ?? "Envoi impossible.");
    });
  }
  function remindAssignee(t: Task) {
    startTransition(async () => {
      const res = await remindAssigneeAction(orgSlug, t.id);
      if (res.ok) toast.success("Relance envoyée ✓");
      else toast.error(res.error ?? "Envoi impossible.");
    });
  }

  if (tasks.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><ListTodo className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucune tâche pour le moment</div>
        <p className="mc-empty-sub">Suivez le travail de l&apos;équipe : à faire, en cours, fait.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle tâche</button>
        <p className="mt-2 text-[11px] text-warmgray/60 max-w-xs">💡 Assignez des tâches à l&apos;équipe, définissez une priorité et suivez l&apos;avancement en temps réel</p>
      </div></div>
      <TaskForm key="create-open" open={formOpen} task={null} persons={persons} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Tâches</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.aFaire}</div><div className="mc-stat-lbl">À faire</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#1d4ed8" }}>{kpis.enCours}</div><div className="mc-stat-lbl">En cours</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#c2452f" }}>{kpis.enRetard}</div><div className="mc-stat-lbl">En retard</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.faites}</div><div className="mc-stat-lbl">Faites</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Priorité</span>
          <div className="mc-chips">{TASK_PRIORITIES.map((p) => (
            <button key={p.value} type="button" className={`mc-chip ${prioF.has(p.value) ? "active" : ""}`} onClick={() => setPrioF((s) => toggle(s, p.value))}>{p.label}</button>
          ))}</div>
        </div>
      </div>

      <div className="mc-kanban" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {TASK_KANBAN.map((status) => (
          <div key={status} className="mc-kanban-col">
            <div className="mc-kanban-head">
              <span className="mc-kanban-title"><span className="mc-kanban-dot" style={{ background: taskStatusDot(status) }} />{taskStatusLabel(status)}</span>
              <span className="mc-kanban-count">{byStatus[status].length}</span>
            </div>
            {byStatus[status].length === 0 ? <div className="mc-kanban-empty">—</div> : byStatus[status].map((t) => <TaskCard key={t.id} t={t} personName={personName} onSelect={setSelectedId} />)}
          </div>
        ))}
      </div>

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche tâche">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex gap-1.5"><PrioBadge p={selected.priority} /><span className="mc-badge mc-badge-gray">{taskStatusLabel(selected.status)}</span></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <dl className="grid grid-cols-1 gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div className="flex items-center gap-2"><Calendar className="size-4 text-warmgray" /><span className={isOverdue(selected.due_date, selected.status) ? "font-semibold text-coral-dark" : ""}>{formatDue(selected.due_date)}</span></div>
                {personName(selected.assignee_id) ? <div className="flex items-center gap-2"><User className="size-4 text-warmgray" /><span>{personName(selected.assignee_id)}</span></div> : null}
                {selected.related_label ? <div><span className="mc-tag">{selected.related_label}</span></div> : null}
              </dl>
              {selected.description ? <p className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.description}</p> : null}

              {/* Assignation & suivi par email */}
              {(() => {
                const assignee = selected.assignee_id ? personById.get(selected.assignee_id) : null;
                if (!assignee) return null;
                const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                return (
                  <div className="rounded-xl bg-white p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                      <Mail className="size-4 text-warmgray" /> Suivi de l&apos;assignation
                    </div>
                    {selected.validated_at ? (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700">
                        <CheckCircle2 className="size-4" /> Validée par {assignee.name} le {fmtDateTime(selected.validated_at)}
                      </div>
                    ) : !assignee.email ? (
                      <p className="text-[12.5px] leading-snug text-warmgray">
                        💡 Ajoutez un email à <strong>{assignee.name}</strong> dans <em>Personnes</em> pour pouvoir le/la prévenir et lui permettre de valider la tâche en un clic.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2.5 text-[12.5px] leading-snug text-warmgray">
                          {selected.assignee_notified_at
                            ? <>Prévenu·e le {fmtDateTime(selected.assignee_notified_at)}{selected.last_reminder_at ? <> · relancé·e le {fmtDateTime(selected.last_reminder_at)}</> : null}</>
                            : <>{assignee.name} n&apos;a pas encore été prévenu·e par email.</>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selected.assignee_notified_at ? (
                            <button type="button" disabled={pending} onClick={() => remindAssignee(selected)} className="mc-btn mc-btn-outline mc-btn-sm">
                              <Send className="size-3.5" /> Relancer
                            </button>
                          ) : (
                            <button type="button" disabled={pending} onClick={() => notifyAssignee(selected)} className="mc-btn mc-btn-lime mc-btn-sm">
                              <Mail className="size-3.5" /> Prévenir par email
                            </button>
                          )}
                          {selected.assignee_notified_at ? (
                            <button type="button" disabled={pending} onClick={() => notifyAssignee(selected)} className="mc-btn mc-btn-outline mc-btn-sm">
                              Renvoyer l&apos;assignation
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-wrap gap-2">
                {selected.status !== "a_faire" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "a_faire")} className="mc-btn mc-btn-outline mc-btn-sm">À faire</button> : null}
                {selected.status !== "en_cours" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "en_cours")} className="mc-btn mc-btn-outline mc-btn-sm">En cours</button> : null}
                {selected.status !== "fait" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "fait")} className="mc-btn mc-btn-outline mc-btn-sm"><Check className="size-3.5" /> Fait</button> : null}
              </div>
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <TaskForm key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} task={editing} persons={persons} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette tâche ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimée.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
