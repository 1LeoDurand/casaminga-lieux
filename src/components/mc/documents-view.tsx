"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Search, RotateCcw, Plus, Pencil, Trash2, FileText, ExternalLink, User, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { DocumentForm, type DocumentFormValues } from "@/components/mc/document-form";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, docTypeLabel, docTypeBadge, docStatusLabel, docStatusBadge, formatDate } from "@/lib/documents-meta";
import { createDocumentAction, deleteDocumentAction, updateDocumentAction } from "@/app/(admin)/dashboard/[org]/documents/actions";
import type { Document, Person } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
/** N'autorise que les URL http(s) — bloque javascript:, data:, etc. (XSS). */
function safeFileUrl(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}
function TypeBadge({ t }: { t: string }) { return <span className={`mc-badge ${docTypeBadge(t)}`}>{docTypeLabel(t)}</span>; }
function StatBadge({ s }: { s: string }) { return <span className={`mc-badge ${docStatusBadge(s)}`}>{docStatusLabel(s)}</span>; }

export function DocumentsView({ documents, persons, orgSlug, orgId }: {
  documents: Document[]; persons: Person[]; orgSlug: string; orgId: string;
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [statF, setStatF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Document | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const personName = (id: string | null) => id ? personById.get(id)?.name ?? null : null;
  const selected = documents.find((d) => d.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: documents.length,
    signes: documents.filter((d) => d.status === "signe").length,
    envoyes: documents.filter((d) => d.status === "envoye").length,
    brouillons: documents.filter((d) => d.status === "brouillon").length,
    avecFichier: documents.filter((d) => d.file_url).length,
  }), [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeF.size && !typeF.has(d.type)) return false;
      if (statF.size && !statF.has(d.status)) return false;
      if (q) {
        const hay = [d.title, d.notes, personName(d.person_id), docTypeLabel(d.type)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, search, typeF, statF, personById]);

  const hasFilters = search.trim() !== "" || typeF.size > 0 || statF.size > 0;

  function submitForm(values: DocumentFormValues) {
    const payload = {
      person_id: values.personId || null, title: values.title, type: values.type,
      status: values.status, file_url: values.fileUrl.trim() || null,
      file_name: values.fileName.trim() || null, notes: values.notes.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateDocumentAction(orgSlug, editing.id, payload)
        : await createDocumentAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Document mis à jour" : "Document créé"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function quickStatus(d: Document, status: Document["status"]) {
    startTransition(async () => {
      const res = await updateDocumentAction(orgSlug, d.id, { status });
      if (res.ok) toast.success(`Document ${docStatusLabel(status).toLowerCase()}`);
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function doDelete(d: Document) {
    startTransition(async () => {
      const { ok } = await deleteDocumentAction(orgSlug, d.id);
      if (ok) { toast.success("Document supprimé"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (documents.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><FileText className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucun document pour le moment</div>
        <p className="mc-empty-sub">Contrats, devis, factures, conventions — centralisez les documents du lieu.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouveau document</button>
      </div></div>
      <DocumentForm key="create-open" open={formOpen} document={null} persons={persons} orgId={orgId} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Documents</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.signes}</div><div className="mc-stat-lbl">Signés</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.envoyes}</div><div className="mc-stat-lbl">Envoyés</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#8a8a8a" }}>{kpis.brouillons}</div><div className="mc-stat-lbl">Brouillons</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.avecFichier}</div><div className="mc-stat-lbl">Avec fichier</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search"><span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouveau</button>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setSearch(""); setTypeF(new Set()); setStatF(new Set()); }} disabled={!hasFilters}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">{DOCUMENT_TYPES.map((t) => (
            <button key={t.value} type="button" className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`} onClick={() => setTypeF((s) => toggle(s, t.value))}>{t.label}</button>
          ))}</div>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">{DOCUMENT_STATUSES.map((s) => (
            <button key={s.value} type="button" className={`mc-chip ${statF.has(s.value) ? "active" : ""}`} onClick={() => setStatF((set) => toggle(set, s.value))}>{s.label}</button>
          ))}</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><Search className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucun résultat</div>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={() => { setSearch(""); setTypeF(new Set()); setStatF(new Set()); }}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div></div>
      ) : (
        <div className="mc-card overflow-hidden">
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>Document</th><th>Type</th><th>Statut</th><th>Personne</th><th>Créé le</th></tr></thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} onClick={() => setSelectedId(d.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-warmgray" />
                        <span className="font-semibold text-foreground">{d.title}</span>
                        {d.file_url ? <ExternalLink className="size-3.5 shrink-0 text-warmgray" /> : null}
                      </div>
                    </td>
                    <td><TypeBadge t={d.type} /></td>
                    <td><StatBadge s={d.status} /></td>
                    <td className="text-[12px] text-warmgray">{personName(d.person_id) ?? "—"}</td>
                    <td className="text-[12px] text-warmgray">{formatDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche document">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5"><TypeBadge t={selected.type} /><StatBadge s={selected.status} /></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <dl className="grid grid-cols-1 gap-2.5 rounded-xl bg-white p-4 text-sm">
                {personName(selected.person_id) ? <div className="flex items-center gap-2"><User className="size-4 text-warmgray" /><span>{personName(selected.person_id)}</span></div> : null}
                <div className="text-warmgray">Créé le {formatDate(selected.created_at)}</div>
                {safeFileUrl(selected.file_url) ? (
                  <a href={safeFileUrl(selected.file_url)!} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-coral-dark hover:underline" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="size-4" /> {selected.file_name ?? "Ouvrir le fichier"}
                  </a>
                ) : <div className="text-warmgray italic">Aucun fichier joint</div>}
              </dl>
              {selected.notes ? (
                <div><h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.notes}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {selected.status === "brouillon" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "envoye")} className="mc-btn mc-btn-outline mc-btn-sm"><Send className="size-3.5" /> Marquer envoyé</button> : null}
                {selected.status === "envoye" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "signe")} className="mc-btn mc-btn-outline mc-btn-sm"><CheckCircle2 className="size-3.5" /> Marquer signé</button> : null}
                {selected.status !== "archive" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "archive")} className="mc-btn mc-btn-outline mc-btn-sm">Archiver</button> : null}
              </div>
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <DocumentForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} document={editing} persons={persons} orgId={orgId} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer ce document ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimé.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
