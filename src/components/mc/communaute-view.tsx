"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, Users, Check, Archive, User } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  COMMUNITY_TYPES, COMMUNITY_STATUSES,
  communityTypeLabel, communityTypeBadge, communityStatusLabel, communityStatusBadge, formatDate,
} from "@/lib/community-meta";
import { createCommunityPostAction, deleteCommunityPostAction, updateCommunityPostAction } from "@/app/(admin)/dashboard/[org]/communaute/actions";
import type { CommunityPost, Person } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
function TypeBadge({ t }: { t: string }) { return <span className={`mc-badge ${communityTypeBadge(t)}`}>{communityTypeLabel(t)}</span>; }
function StatBadge({ s }: { s: string }) { return <span className={`mc-badge ${communityStatusBadge(s)}`}>{communityStatusLabel(s)}</span>; }

interface FormValues { type: CommunityPost["type"]; title: string; content: string; status: CommunityPost["status"]; authorId: string; }
function fromPost(p: CommunityPost | null): FormValues {
  return { type: p?.type ?? "info", title: p?.title ?? "", content: p?.content ?? "", status: p?.status ?? "actif", authorId: p?.author_id ?? "" };
}

function PostModal({ open, post, persons, busy, onSubmit, onClose }: {
  open: boolean; post: CommunityPost | null; persons: Person[]; busy: boolean;
  onSubmit: (v: FormValues) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FormValues>(fromPost(post));
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
          <h2 className="font-heading text-xl font-bold text-foreground">{post ? "Modifier la publication" : "Nouvelle publication"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Type</label>
              <select className="mc-input" value={v.type} onChange={(e) => set("type", e.target.value as CommunityPost["type"])}>
                {COMMUNITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="mc-form-group"><label className="mc-form-label">Statut</label>
              <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as CommunityPost["status"])}>
                {COMMUNITY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Auteur·e</label>
            <select className="mc-input" value={v.authorId} onChange={(e) => set("authorId", e.target.value)}>
              <option value="">— Anonyme —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={v.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Prêt de matériel, recherche bénévoles…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Contenu *</label>
            <textarea className="mc-textarea" style={{ minHeight: 100 }} value={v.content} onChange={(e) => set("content", e.target.value)} placeholder="Détaillez votre offre, demande ou information…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : post ? "Enregistrer" : "Publier"}</button>
        </div>
      </div>
    </div>
  );
}

export function CommunauteView({ posts, persons, orgSlug, orgId }: {
  posts: CommunityPost[]; persons: Person[]; orgSlug: string; orgId: string;
}) {
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CommunityPost | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const authorName = (id: string | null) => id ? personById.get(id)?.name ?? "Membre" : "Anonyme";
  const selected = posts.find((p) => p.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: posts.length,
    actifs: posts.filter((p) => p.status === "actif").length,
    offres: posts.filter((p) => p.type === "offre").length,
    demandes: posts.filter((p) => p.type === "demande").length,
  }), [posts]);

  const filtered = useMemo(() => posts.filter((p) => {
    if (!showResolved && p.status !== "actif") return false;
    if (typeF.size && !typeF.has(p.type)) return false;
    return true;
  }), [posts, typeF, showResolved]);

  function submitForm(values: FormValues) {
    const payload = { type: values.type, title: values.title, content: values.content, status: values.status, author_id: values.authorId || null };
    startTransition(async () => {
      const res = editing
        ? await updateCommunityPostAction(orgSlug, editing.id, payload)
        : await createCommunityPostAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Publication mise à jour" : "Publication créée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible.");
    });
  }
  function quickStatus(p: CommunityPost, status: CommunityPost["status"]) {
    startTransition(async () => {
      const res = await updateCommunityPostAction(orgSlug, p.id, { status });
      if (res.ok) toast.success(`Publication : ${communityStatusLabel(status).toLowerCase()}`);
      else toast.error("Action impossible.");
    });
  }
  function doDelete(p: CommunityPost) {
    startTransition(async () => {
      const { ok } = await deleteCommunityPostAction(orgSlug, p.id);
      if (ok) { toast.success("Publication supprimée"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (posts.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Users className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Le fil de la communauté est vide</div>
        <p className="mc-empty-sub">Offres, demandes, entraide, infos — animez la vie du collectif.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle publication</button>
      </div></div>
      <PostModal open={formOpen} post={null} persons={persons} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Publications</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.actifs}</div><div className="mc-stat-lbl">Actives</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.offres}</div><div className="mc-stat-lbl">Offres</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.demandes}</div><div className="mc-stat-lbl">Demandes</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Publier</button>
          <button type="button" className={`mc-btn mc-btn-sm ${showResolved ? "mc-btn-lime" : "mc-btn-outline"}`} onClick={() => setShowResolved((s) => !s)}>
            {showResolved ? "Tout afficher" : "Masquer résolus/archivés"}
          </button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">{COMMUNITY_TYPES.map((t) => (
            <button key={t.value} type="button" className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`} onClick={() => setTypeF((s) => toggle(s, t.value))}>{t.label}</button>
          ))}</div>
        </div>
      </div>

      <div className="mc-cards-grid">
        {filtered.map((p) => (
          <button key={p.id} type="button" className="mc-card cursor-pointer p-5 text-left transition-shadow hover:shadow-md" onClick={() => setSelectedId(p.id)}>
            <div className="flex items-center gap-2"><TypeBadge t={p.type} />{p.status !== "actif" ? <StatBadge s={p.status} /> : null}</div>
            <div className="mt-2 font-semibold text-foreground">{p.title}</div>
            <p className="mt-1 line-clamp-3 text-sm text-warmgray">{p.content}</p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-warmgray"><User className="size-3" /> {authorName(p.author_id)} · {formatDate(p.created_at)}</div>
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche publication">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex gap-1.5"><TypeBadge t={selected.type} /><StatBadge s={selected.status} /></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <p className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.content}</p>
              <div className="flex items-center gap-1.5 text-[12px] text-warmgray"><User className="size-3.5" /> {authorName(selected.author_id)} · {formatDate(selected.created_at)}</div>
              <div className="flex flex-wrap gap-2">
                {selected.status === "actif" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "resolu")} className="mc-btn mc-btn-outline mc-btn-sm"><Check className="size-3.5" /> Marquer résolu</button> : null}
                {selected.status !== "archive" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "archive")} className="mc-btn mc-btn-outline mc-btn-sm"><Archive className="size-3.5" /> Archiver</button> : null}
                {selected.status !== "actif" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "actif")} className="mc-btn mc-btn-outline mc-btn-sm">Réactiver</button> : null}
              </div>
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <PostModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} post={editing} persons={persons} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette publication ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimée.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
