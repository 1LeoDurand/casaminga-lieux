"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus, FileText, FileDown, Pencil, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  PERIOD_TYPES, SECTIONS, periodLabel, formatDateFr, suggestPeriodRange, defaultNoteTitle,
} from "@/lib/coordination/meta";
import { createCoordinationNote, deleteCoordinationNote } from "@/app/(admin)/dashboard/[org]/impact/notes/actions";
import type { CoordinationNote, PeriodType, SectionKey } from "@/lib/coordination/types";

function CreateModal({ orgSlug, orgId, onClose }: { orgSlug: string; orgId: string; onClose: () => void }) {
  const router = useRouter();
  const initial = suggestPeriodRange("mensuel");
  const [periodType, setPeriodType] = useState<PeriodType>("mensuel");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [title, setTitle] = useState(defaultNoteTitle("mensuel", initial.start, initial.end));
  const [titleTouched, setTitleTouched] = useState(false);
  const [picked, setPicked] = useState<Set<SectionKey>>(new Set(SECTIONS.map((s) => s.key)));
  const [pending, start_] = useTransition();

  function changeType(t: PeriodType) {
    setPeriodType(t);
    if (t !== "personnalise") {
      const r = suggestPeriodRange(t);
      setStart(r.start); setEnd(r.end);
      if (!titleTouched) setTitle(defaultNoteTitle(t, r.start, r.end));
    }
  }
  function toggle(k: SectionKey) {
    setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  function submit() {
    if (!title.trim()) { toast.error("Le titre est obligatoire."); return; }
    if (start > end) { toast.error("La période est invalide (début après fin)."); return; }
    if (picked.size === 0) { toast.error("Choisissez au moins un bloc."); return; }
    start_(async () => {
      const res = await createCoordinationNote(orgSlug, {
        organization_id: orgId, title, period_type: periodType,
        period_start: start, period_end: end, sections: Array.from(picked),
      });
      if (res.ok && res.id) { toast.success("Note créée"); router.push(`/dashboard/${orgSlug}/impact/notes/${res.id}`); }
      else toast.error(res.error ?? "Création impossible.");
    });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Nouvelle note de coordination</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group">
            <label className="mc-form-label">Périodicité</label>
            <select className="mc-input" value={periodType} onChange={(e) => changeType(e.target.value as PeriodType)}>
              {PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Du</label>
              <input type="date" className="mc-input" value={start} onChange={(e) => { setStart(e.target.value); setPeriodType("personnalise"); }} /></div>
            <div className="mc-form-group"><label className="mc-form-label">Au</label>
              <input type="date" className="mc-input" value={end} onChange={(e) => { setEnd(e.target.value); setPeriodType("personnalise"); }} /></div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Titre</label>
            <input className="mc-input" value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
          </div>
          <div>
            <label className="mc-form-label">Blocs à inclure</label>
            <div className="mt-1 flex flex-col gap-2">
              {SECTIONS.map((s) => (
                <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${picked.has(s.key) ? "border-coral bg-peach-pale/40" : "border-slate-200 hover:border-slate-300"}`}>
                  <input type="checkbox" className="mt-0.5" checked={picked.has(s.key)} onChange={() => toggle(s.key)} />
                  <span><span className="text-sm font-semibold text-foreground">{s.label}</span><br /><span className="text-[12px] text-warmgray">{s.hint}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={pending}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={pending}>{pending ? "…" : "Créer et composer"}</button>
        </div>
      </div>
    </div>
  );
}

export function CoordinationNotesPanel({ notes, orgSlug, orgId }: { notes: CoordinationNote[]; orgSlug: string; orgId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CoordinationNote | null>(null);
  const [pending, startTransition] = useTransition();

  function doDelete(n: CoordinationNote) {
    startTransition(async () => {
      const { ok } = await deleteCoordinationNote(orgSlug, n.id);
      if (ok) { toast.success("Note supprimée"); setConfirmDelete(null); } else toast.error("Suppression impossible.");
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-warmgray" />
          <h3 className="text-sm font-semibold text-foreground">Notes de coordination</h3>
          <span className="text-[11px] text-warmgray">— bilans périodiques composables, éditables et exportables en Word</span>
        </div>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Nouvelle note</button>
      </div>

      {notes.length === 0 ? (
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><FileText className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucune note de coordination</div>
          <p className="mc-empty-sub">Composez un bilan mensuel, trimestriel ou annuel à partir de vos données, puis exportez-le en Word.</p>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Nouvelle note</button>
        </div></div>
      ) : (
        <div className="mc-card divide-y divide-slate-100 p-0">
          {notes.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/dashboard/${orgSlug}/impact/notes/${n.id}`} className="min-w-[220px] flex-1 group">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground group-hover:text-coral-dark">{n.title}</span>
                  <span className={`mc-badge ${n.status === "finalisee" ? "mc-badge-green" : "mc-badge-gray"}`}>{n.status === "finalisee" ? "Finalisée" : "Brouillon"}</span>
                </div>
                <div className="text-[12px] text-warmgray">{periodLabel(n.period_type, n.period_start, n.period_end)} · {formatDateFr(n.period_start)} – {formatDateFr(n.period_end)}</div>
              </Link>
              <div className="flex items-center gap-1">
                <a href={`/dashboard/${orgSlug}/impact/notes/${n.id}/docx`} title="Exporter en Word" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><FileDown className="size-4" /></a>
                <Link href={`/dashboard/${orgSlug}/impact/notes/${n.id}`} title="Modifier" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><Pencil className="size-4" /></Link>
                <button type="button" title="Supprimer" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => setConfirmDelete(n)}><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen ? <CreateModal orgSlug={orgSlug} orgId={orgId} onClose={() => setCreateOpen(false)} /> : null}
      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette note ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimée.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
