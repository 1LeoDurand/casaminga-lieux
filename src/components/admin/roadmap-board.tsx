"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Plus, X, Trash2, Calendar, Hash } from "lucide-react";
import { toast } from "sonner";
import { TaskBoard, type BoardColumn } from "@/components/mc/task-board";
import {
  ROADMAP_STATUSES, ROADMAP_PLATFORMS, ROADMAP_KINDS,
  type RoadmapEffort, type RoadmapKind, type RoadmapPlatform, type RoadmapPriority, type RoadmapStatus, type RoadmapTask,
} from "@/lib/admin/roadmap-meta";
import {
  createRoadmapTask, deleteRoadmapTask, moveRoadmapTask, updateRoadmapTask,
} from "@/app/admin/roadmap/actions";

const COLUMNS: BoardColumn[] = ROADMAP_STATUSES.map((s) => ({
  id: s.value,
  label: s.label,
  dot: s.dot,
  empty: s.hint,
}));

const PRIO_BADGE: Record<RoadmapPriority, string> = {
  haute: "mc-badge-red",
  normale: "mc-badge-orange",
  basse: "mc-badge-gray",
};
const PRIO_LABEL: Record<RoadmapPriority, string> = { haute: "Haute", normale: "Normale", basse: "Basse" };
const EFFORTS: RoadmapEffort[] = ["XS", "S", "M", "L", "XL"];

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

const PLATFORM_LABEL: Record<RoadmapPlatform, string> = ROADMAP_PLATFORMS.reduce(
  (acc, p) => ({ ...acc, [p.value]: p.label }),
  {} as Record<RoadmapPlatform, string>,
);

function Card({ t, showPlatform }: { t: RoadmapTask; showPlatform?: boolean }) {
  const due = formatDue(t.due_date);
  return (
    <div className={`mc-resa-card ${t.status === "fait" ? "is-annulee" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="mc-resa-title">{t.title}</span>
        <span className={`mc-badge ${PRIO_BADGE[t.priority]}`}>{PRIO_LABEL[t.priority]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {showPlatform ? (
          <span className="mc-badge mc-badge-gray">{PLATFORM_LABEL[t.platform]}</span>
        ) : null}
        {t.roadmap_ref ? (
          <span className="mc-tag inline-flex items-center gap-1">
            <Hash className="size-3" />{t.roadmap_ref}
          </span>
        ) : null}
        {t.effort ? <span className="mc-badge mc-badge-gray">{t.effort}</span> : null}
      </div>
      {due ? <div className="mc-resa-line"><Calendar className="size-3.5" /> {due}</div> : null}
    </div>
  );
}

export function RoadmapBoard({
  tasks,
  defaultPlatform = "admin",
  showPlatform = false,
}: {
  tasks: RoadmapTask[];
  defaultPlatform?: RoadmapPlatform;
  showPlatform?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Le déplacement doit se voir immédiatement : sans cela, la carte reviendrait
  // à sa colonne d'origine le temps de l'aller-retour serveur.
  const [view, applyMove] = useOptimistic(
    tasks,
    (state: RoadmapTask[], m: { id: string; status: RoadmapStatus }) =>
      state.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );

  const selected = view.find((t) => t.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const m = new Map<string, number>(COLUMNS.map((c) => [c.id, 0]));
    for (const t of view) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [view]);

  function move(id: string, status: string) {
    startTransition(async () => {
      applyMove({ id, status: status as RoadmapStatus });
      const res = await moveRoadmapTask(id, status);
      if (!res.ok) toast.error(res.error ?? "Déplacement impossible.");
    });
  }

  function save(id: string, patch: Parameters<typeof updateRoadmapTask>[1]) {
    startTransition(async () => {
      const res = await updateRoadmapTask(id, patch);
      if (res.ok) toast.success("Enregistré");
      else toast.error(res.error ?? "Enregistrement impossible.");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteRoadmapTask(id);
      if (res.ok) { toast.success("Carte supprimée"); setSelectedId(null); }
      else toast.error(res.error ?? "Suppression impossible.");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        {ROADMAP_STATUSES.map((s) => (
          <div key={s.value} className="mc-stat">
            <div className="mc-stat-val" style={{ color: s.dot }}>{counts.get(s.value) ?? 0}</div>
            <div className="mc-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mc-card p-[18px]">
        <button
          type="button"
          className="mc-btn mc-btn-lime mc-btn-sm"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" /> Nouvelle carte
        </button>
        <p className="mt-2 text-[11px] text-warmgray">
          Glisse une carte pour changer sa colonne. Au clavier : Espace pour saisir, flèches pour
          déplacer, Espace pour lâcher, Entrée pour ouvrir le détail.
        </p>
      </div>

      <TaskBoard
        columns={COLUMNS}
        items={view}
        getId={(t) => t.id}
        getColumnId={(t) => t.status}
        onMove={move}
        onCardClick={setSelectedId}
        disabled={pending}
        renderCard={(t) => <Card t={t} showPlatform={showPlatform} />}
      />

      {selected ? (
        <Detail
          key={selected.id}
          task={selected}
          busy={pending}
          onClose={() => setSelectedId(null)}
          onSave={(patch) => save(selected.id, patch)}
          onDelete={() => remove(selected.id)}
        />
      ) : null}

      {creating ? (
        <Detail
          key="create"
          task={null}
          defaultPlatform={defaultPlatform}
          busy={pending}
          onClose={() => setCreating(false)}
          onSave={(patch) => {
            startTransition(async () => {
              const res = await createRoadmapTask({ title: patch.title ?? "", ...patch });
              if (res.ok) { toast.success("Carte créée"); setCreating(false); }
              else toast.error(res.error ?? "Création impossible.");
            });
          }}
        />
      ) : null}
    </div>
  );
}

function Detail({ task, defaultPlatform = "admin", busy, onClose, onSave, onDelete }: {
  task: RoadmapTask | null;
  defaultPlatform?: RoadmapPlatform;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: {
    title?: string; description?: string | null; status?: RoadmapStatus;
    priority?: RoadmapPriority; effort?: RoadmapEffort | null;
    roadmap_ref?: string | null; due_date?: string | null;
    platform?: RoadmapPlatform; kind?: RoadmapKind | null;
  }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<RoadmapStatus>(task?.status ?? "a_trier");
  const [priority, setPriority] = useState<RoadmapPriority>(task?.priority ?? "normale");
  const [effort, setEffort] = useState<string>(task?.effort ?? "");
  const [ref, setRef] = useState(task?.roadmap_ref ?? "");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [platform, setPlatform] = useState<RoadmapPlatform>(task?.platform ?? defaultPlatform);
  const [kind, setKind] = useState<string>(task?.kind ?? "");

  function submit() {
    if (!title.trim()) { toast.error("Le titre est obligatoire."); return; }
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      status, priority,
      effort: (effort || null) as RoadmapEffort | null,
      roadmap_ref: ref.trim() || null,
      due_date: due || null,
      platform,
      kind: (kind || null) as RoadmapKind | null,
    });
  }

  return (
    <>
      <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={onClose} />
      <aside className="mc-drawer" aria-label={task ? "Détail de la carte" : "Nouvelle carte"}>
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {task ? "Modifier la carte" : "Nouvelle carte"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-warmgray">Titre *</span>
            <input className="mc-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-warmgray">Description</span>
            <textarea className="mc-textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Colonne</span>
              <select className="mc-input" value={status} onChange={(e) => setStatus(e.target.value as RoadmapStatus)}>
                {ROADMAP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Priorité</span>
              <select className="mc-input" value={priority} onChange={(e) => setPriority(e.target.value as RoadmapPriority)}>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
                <option value="basse">Basse</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Ampleur</span>
              <select className="mc-input" value={effort} onChange={(e) => setEffort(e.target.value)}>
                <option value="">—</option>
                {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Réf. ROADMAP</span>
              <input className="mc-input" placeholder="B2" value={ref} onChange={(e) => setRef(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Plateforme</span>
              <select className="mc-input" value={platform} onChange={(e) => setPlatform(e.target.value as RoadmapPlatform)}>
                {ROADMAP_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-warmgray">Nature</span>
              <select className="mc-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">—</option>
                {ROADMAP_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-warmgray">Échéance</span>
            <input type="date" className="mc-input" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>

          <div className="mt-2 flex gap-2">
            <button type="button" className="mc-btn mc-btn-lime flex-1" disabled={busy} onClick={submit}>
              {busy ? "…" : task ? "Enregistrer" : "Créer"}
            </button>
            {onDelete ? (
              <button
                type="button"
                className="mc-btn mc-btn-outline"
                disabled={busy}
                onClick={onDelete}
                aria-label="Supprimer la carte"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
