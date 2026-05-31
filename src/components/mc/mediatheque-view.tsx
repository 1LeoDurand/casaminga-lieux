"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Search, RotateCcw, Plus, Pencil, Trash2, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { createMediaAction, deleteMediaAction, updateMediaAction } from "@/app/(admin)/dashboard/[org]/mediatheque/actions";
import type { Media } from "@/lib/types";

const MEDIA_TYPES = [
  { value: "photo", label: "Photo", badge: "mc-badge-lime" },
  { value: "video", label: "Vidéo", badge: "mc-badge-golden" },
  { value: "audio", label: "Audio", badge: "mc-badge-green" },
  { value: "document", label: "Document", badge: "mc-badge-gray" },
];
const TYPE_MAP = Object.fromEntries(MEDIA_TYPES.map((t) => [t.value, t]));
function typeLabel(t: string) { return TYPE_MAP[t]?.label ?? t; }
function typeBadge(t: string) { return TYPE_MAP[t]?.badge ?? "mc-badge-gray"; }

interface FormValues { title: string; type: Media["type"]; url: string; thumbnailUrl: string; altText: string; tagsInput: string; }

function MediaModal({ open, media, busy, onSubmit, onClose }: {
  open: boolean; media: Media | null; busy: boolean;
  onSubmit: (v: FormValues) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FormValues>({
    title: media?.title ?? "", type: media?.type ?? "photo",
    url: media?.url ?? "", thumbnailUrl: media?.thumbnail_url ?? "",
    altText: media?.alt_text ?? "", tagsInput: media?.tags.join(", ") ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof FormValues>(k: K, val: FormValues[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.title.trim()) { setError("Le titre est obligatoire."); return; }
    if (!v.url.trim()) { setError("L'URL est obligatoire."); return; }
    onSubmit({ ...v, title: v.title.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{media ? "Modifier le média" : "Ajouter un média"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={v.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Grande Salle — vernissage 2026" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Type</label>
            <select className="mc-input" value={v.type} onChange={(e) => set("type", e.target.value as Media["type"])}>
              {MEDIA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div className="mc-form-group"><label className="mc-form-label">URL *</label>
            <input className="mc-input" value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Miniature (URL)</label>
            <input className="mc-input" value={v.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://… (400px)" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Texte alternatif</label>
            <input className="mc-input" value={v.altText} onChange={(e) => set("altText", e.target.value)} placeholder="Description de l'image pour l'accessibilité" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Tags (séparés par des virgules)</label>
            <input className="mc-input" value={v.tagsInput} onChange={(e) => set("tagsInput", e.target.value)} placeholder="salle, événement, expo…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : media ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </div>
    </div>
  );
}

export function MediathequeView({ media, orgSlug, orgId }: { media: Media[]; orgSlug: string; orgId: string }) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Media | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Media | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = media.find((m) => m.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media.filter((m) => {
      if (typeF.size && !typeF.has(m.type)) return false;
      if (q) {
        const hay = [m.title, m.alt_text, ...m.tags].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [media, search, typeF]);

  function submitForm(values: FormValues) {
    const payload = {
      title: values.title, type: values.type, url: values.url,
      thumbnail_url: values.thumbnailUrl.trim() || null,
      alt_text: values.altText.trim() || null,
      tags: values.tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
    };
    startTransition(async () => {
      const res = editing
        ? await updateMediaAction(orgSlug, editing.id, payload)
        : await createMediaAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Média mis à jour" : "Média ajouté"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function doDelete(m: Media) {
    startTransition(async () => {
      const { ok } = await deleteMediaAction(orgSlug, m.id);
      if (ok) { toast.success("Média supprimé"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (media.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Image className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Médiathèque vide</div>
        <p className="mc-empty-sub">Photos, vidéos, audios — centralisez les médias du lieu.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Ajouter un média</button>
      </div></div>
      <MediaModal open={formOpen} media={null} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{media.length}</div><div className="mc-stat-lbl">Médias</div></div>
        {MEDIA_TYPES.map((t) => (
          <div key={t.value} className="mc-stat">
            <div className="mc-stat-val">{media.filter((m) => m.type === t.value).length}</div>
            <div className="mc-stat-lbl">{t.label}s</div>
          </div>
        ))}
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search"><span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Ajouter</button>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setSearch(""); setTypeF(new Set()); }} disabled={search === "" && typeF.size === 0}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">{MEDIA_TYPES.map((t) => (
            <button key={t.value} type="button" className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`} onClick={() => setTypeF((s) => { const n = new Set(s); if (n.has(t.value)) { n.delete(t.value); } else { n.add(t.value); } return n; })}>{t.label}</button>
          ))}</div>
        </div>
      </div>

      <div className="mc-cards-grid">
        {filtered.map((m) => (
          <button key={m.id} type="button" className="mc-space-card" onClick={() => setSelectedId(m.id)}>
            {m.thumbnail_url || m.type === "photo" ? (
              <div className="mc-space-cover" role="img" aria-label={m.alt_text ?? m.title} style={{ backgroundImage: `url("${m.thumbnail_url ?? m.url}")` }}>
                <div className="mc-space-badges"><span className={`mc-badge ${typeBadge(m.type)}`}>{typeLabel(m.type)}</span></div>
              </div>
            ) : (
              <div className="mc-space-cover mc-space-cover-ph">
                <div className="mc-space-badges"><span className={`mc-badge ${typeBadge(m.type)}`}>{typeLabel(m.type)}</span></div>
                {typeLabel(m.type)}
              </div>
            )}
            <div className="mc-space-body">
              <div className="truncate font-semibold text-foreground">{m.title}</div>
              {m.tags.length > 0 ? <div className="flex flex-wrap gap-1">{m.tags.slice(0, 3).map((t) => <span key={t} className="mc-tag">{t}</span>)}</div> : null}
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche média">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1"><span className={`mc-badge ${typeBadge(selected.type)}`}>{typeLabel(selected.type)}</span></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              {(selected.thumbnail_url || selected.type === "photo") ? (
                <div className="mc-space-hero" style={{ backgroundImage: `url("${selected.thumbnail_url ?? selected.url}")` }} />
              ) : null}
              <div className="rounded-xl bg-white p-4 text-sm">
                <a href={selected.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-coral-dark hover:underline" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="size-4" /> Ouvrir le fichier
                </a>
                {selected.alt_text ? <p className="mt-2 text-warmgray">{selected.alt_text}</p> : null}
              </div>
              {selected.tags.length > 0 ? <div className="flex flex-wrap gap-1.5">{selected.tags.map((t) => <span key={t} className="mc-tag">{t}</span>)}</div> : null}
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <MediaModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} media={editing} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer ce média ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimé.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
