"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, Megaphone, Eye, EyeOff, Archive } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { createAnnouncementAction, deleteAnnouncementAction, updateAnnouncementAction } from "@/app/(admin)/dashboard/[org]/communication/actions";
import type { Announcement } from "@/lib/types";

const STATUSES = [
  { value: "brouillon", label: "Brouillon", badge: "mc-badge-gray" },
  { value: "publie",    label: "Publié",    badge: "mc-badge-green" },
  { value: "archive",   label: "Archivé",   badge: "mc-badge-gray" },
];
const AUDIENCES = [
  { value: "membres", label: "Membres" },
  { value: "public",  label: "Public" },
  { value: "tous",    label: "Tous" },
];
function statBadge(s: string) { return STATUSES.find((x) => x.value === s)?.badge ?? "mc-badge-gray"; }
function statLabel(s: string) { return STATUSES.find((x) => x.value === s)?.label ?? s; }
function audLabel(a: string) { return AUDIENCES.find((x) => x.value === a)?.label ?? a; }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function fmtDate(iso: string) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d); }

interface FormValues { title: string; content: string; status: Announcement["status"]; audience: Announcement["audience"]; }
function fromAnn(a: Announcement | null): FormValues {
  return { title: a?.title ?? "", content: a?.content ?? "", status: a?.status ?? "brouillon", audience: a?.audience ?? "membres" };
}

function AnnModal({ open, ann, busy, onSubmit, onClose }: {
  open: boolean; ann: Announcement | null; busy: boolean;
  onSubmit: (v: FormValues) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FormValues>(fromAnn(ann));
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof FormValues>(k: K, val: FormValues[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.title.trim()) { setError("Le titre est obligatoire."); return; }
    if (!v.content.trim()) { setError("Le contenu est obligatoire."); return; }
    onSubmit({ ...v, title: v.title.trim(), content: v.content.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{ann ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={v.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Fermeture exceptionnelle, Appel à candidatures…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Statut</label>
              <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as Announcement["status"])}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
            <div className="mc-form-group"><label className="mc-form-label">Audience</label>
              <select className="mc-input" value={v.audience} onChange={(e) => set("audience", e.target.value as Announcement["audience"])}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Contenu *</label>
            <textarea className="mc-textarea" style={{ minHeight: 120 }} value={v.content} onChange={(e) => set("content", e.target.value)} placeholder="Texte de l'annonce…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : ann ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

export function CommunicationView({ announcements, orgSlug, orgId }: { announcements: Announcement[]; orgSlug: string; orgId: string }) {
  const [filterStat, setFilterStat] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = announcements.find((a) => a.id === selectedId) ?? null;

  const filtered = useMemo(() =>
    announcements.filter((a) => filterStat === "all" || a.status === filterStat),
    [announcements, filterStat]);

  const kpis = useMemo(() => ({
    total: announcements.length,
    publies: announcements.filter((a) => a.status === "publie").length,
    brouillons: announcements.filter((a) => a.status === "brouillon").length,
  }), [announcements]);

  function quickStatus(a: Announcement, status: Announcement["status"]) {
    startTransition(async () => {
      const res = await updateAnnouncementAction(orgSlug, a.id, { status });
      if (res.ok) toast.success(`Annonce ${statLabel(status).toLowerCase()}`);
      else toast.error("Action impossible.");
    });
  }

  function submitForm(values: FormValues) {
    startTransition(async () => {
      const res = editing
        ? await updateAnnouncementAction(orgSlug, editing.id, values)
        : await createAnnouncementAction(orgSlug, { ...values, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Annonce mise à jour" : "Annonce créée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible.");
    });
  }

  function doDelete(a: Announcement) {
    startTransition(async () => {
      const { ok } = await deleteAnnouncementAction(orgSlug, a.id);
      if (ok) { toast.success("Annonce supprimée"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (announcements.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Megaphone className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucune annonce pour le moment</div>
        <p className="mc-empty-sub">Publiez des annonces pour votre équipe ou votre communauté.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle annonce</button>
      </div></div>
      <AnnModal key="create-open" open={formOpen} ann={null} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Annonces</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.publies}</div><div className="mc-stat-lbl">Publiées</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#8a8a8a" }}>{kpis.brouillons}</div><div className="mc-stat-lbl">Brouillons</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">
            {["all", ...STATUSES.map((s) => s.value)].map((s) => (
              <button key={s} type="button" className={`mc-chip ${filterStat === s ? "active" : ""}`} onClick={() => setFilterStat(s)}>
                {s === "all" ? "Tous" : statLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((a) => (
          <div key={a.id} className="mc-card cursor-pointer px-5 py-4 transition-shadow hover:shadow-md" onClick={() => setSelectedId(a.id)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{a.title}</span>
                  <span className={`mc-badge ${statBadge(a.status)}`}>{statLabel(a.status)}</span>
                  <span className="mc-badge mc-badge-gray">{audLabel(a.audience)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-warmgray">{a.content}</p>
              </div>
              <span className="shrink-0 text-[11px] text-warmgray">{fmtDate(a.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche annonce">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex gap-1.5">
                  <span className={`mc-badge ${statBadge(selected.status)}`}>{statLabel(selected.status)}</span>
                  <span className="mc-badge mc-badge-gray">{audLabel(selected.audience)}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <p className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.content}</p>
              <div className="text-[12px] text-warmgray">Créé le {fmtDate(selected.created_at)}</div>
              <div className="flex flex-wrap gap-2">
                {selected.status === "brouillon" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "publie")} className="mc-btn mc-btn-outline mc-btn-sm"><Eye className="size-3.5" /> Publier</button> : null}
                {selected.status === "publie" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "brouillon")} className="mc-btn mc-btn-outline mc-btn-sm"><EyeOff className="size-3.5" /> Dépublier</button> : null}
                {selected.status !== "archive" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "archive")} className="mc-btn mc-btn-outline mc-btn-sm"><Archive className="size-3.5" /> Archiver</button> : null}
              </div>
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <AnnModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} ann={editing} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette annonce ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimée.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
