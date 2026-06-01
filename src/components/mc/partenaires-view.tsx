"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, Handshake, Mail, Phone, Globe, User, Search } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  PARTNER_TYPES, PARTNER_STATUSES, partnerTypeLabel, partnerTypeBadge,
  partnerStatusLabel, partnerStatusBadge, partnerInitials,
} from "@/lib/partners-meta";
import { createPartnerAction, updatePartnerAction, deletePartnerAction } from "@/app/(admin)/dashboard/[org]/partenaires/actions";
import type { Partner, Person } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
function TypeBadge({ t }: { t: string }) { return <span className={`mc-badge ${partnerTypeBadge(t)}`}>{partnerTypeLabel(t)}</span>; }
function StatBadge({ s }: { s: string }) { return <span className={`mc-badge ${partnerStatusBadge(s)}`}>{partnerStatusLabel(s)}</span>; }

interface FV { name: string; type: Partner["type"]; status: Partner["status"]; contactId: string; email: string; phone: string; website: string; notes: string; }
function fromPartner(p: Partner | null): FV {
  return { name: p?.name ?? "", type: p?.type ?? "autre", status: p?.status ?? "prospect", contactId: p?.contact_id ?? "",
    email: p?.email ?? "", phone: p?.phone ?? "", website: p?.website ?? "", notes: p?.notes ?? "" };
}
function PartnerModal({ open, partner, persons, busy, onSubmit, onClose }: {
  open: boolean; partner: Partner | null; persons: Person[]; busy: boolean; onSubmit: (v: FV) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FV>(fromPartner(partner));
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof FV>(k: K, val: FV[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() { if (!v.name.trim()) { setError("Le nom est obligatoire."); return; } onSubmit({ ...v, name: v.name.trim() }); }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{partner ? "Modifier le partenaire" : "Nouveau partenaire"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Nom *</label>
            <input className="mc-input" value={v.name} autoFocus onChange={(e) => set("name", e.target.value)} placeholder="Mairie, fondation, entreprise…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Type</label>
              <select className="mc-input" value={v.type} onChange={(e) => set("type", e.target.value as Partner["type"])}>
                {PARTNER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="mc-form-group"><label className="mc-form-label">Statut</label>
              <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as Partner["status"])}>
                {PARTNER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Interlocuteur·rice (personne)</label>
            <select className="mc-input" value={v.contactId} onChange={(e) => set("contactId", e.target.value)}>
              <option value="">— Aucun —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Email</label>
              <input className="mc-input" value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@…" /></div>
            <div className="mc-form-group"><label className="mc-form-label">Téléphone</label>
              <input className="mc-input" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33…" /></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Site web</label>
            <input className="mc-input" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Notes</label>
            <textarea className="mc-textarea" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Nature du partenariat, historique…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : partner ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

export function PartenairesView({ partners, persons, orgSlug, orgId }: {
  partners: Partner[]; persons: Person[]; orgSlug: string; orgId: string;
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Partner | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const contactName = (id: string | null) => id ? personById.get(id)?.name ?? null : null;
  const selected = partners.find((p) => p.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: partners.length,
    actifs: partners.filter((p) => p.status === "actif").length,
    prospects: partners.filter((p) => p.status === "prospect").length,
    publics: partners.filter((p) => p.type === "public").length,
  }), [partners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((p) => {
      if (typeF.size && !typeF.has(p.type)) return false;
      if (statusF.size && !statusF.has(p.status)) return false;
      if (q && !`${p.name} ${p.notes ?? ""} ${partnerTypeLabel(p.type)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [partners, search, typeF, statusF]);

  function submitForm(v: FV) {
    const payload = { name: v.name, type: v.type, status: v.status, contact_id: v.contactId || null,
      email: v.email.trim() || null, phone: v.phone.trim() || null, website: v.website.trim() || null, notes: v.notes.trim() || null };
    startTransition(async () => {
      const res = editing ? await updatePartnerAction(orgSlug, editing.id, payload) : await createPartnerAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Partenaire mis à jour" : "Partenaire créé"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible.");
    });
  }
  function doDelete(p: Partner) {
    startTransition(async () => {
      const { ok } = await deletePartnerAction(orgSlug, p.id);
      if (ok) { toast.success("Partenaire supprimé"); setConfirmDelete(null); setSelectedId(null); } else toast.error("Suppression impossible.");
    });
  }

  if (partners.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Handshake className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucun partenaire</div>
        <p className="mc-empty-sub">Constituez l&apos;annuaire : collectivités, fondations, entreprises, associations.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouveau partenaire</button>
        <p className="mt-2 text-[11px] text-warmgray/60 max-w-xs">💡 Les partenaires apparaissent sur votre vitrine publique — collectivités, fondations, mécènes</p>
      </div></div>
      <PartnerModal open={formOpen} partner={null} persons={persons} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Partenaires</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.actifs}</div><div className="mc-stat-lbl">Actifs</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.prospects}</div><div className="mc-stat-lbl">Prospects</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.publics}</div><div className="mc-stat-lbl">Publics</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search"><span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouveau</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">{PARTNER_TYPES.map((t) => (
            <button key={t.value} type="button" className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`} onClick={() => setTypeF((s) => toggle(s, t.value))}>{t.label}</button>
          ))}</div></div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">{PARTNER_STATUSES.map((s) => (
            <button key={s.value} type="button" className={`mc-chip ${statusF.has(s.value) ? "active" : ""}`} onClick={() => setStatusF((set) => toggle(set, s.value))}>{s.label}</button>
          ))}</div></div>
      </div>

      <div className="mc-cards-grid">
        {filtered.map((p) => (
          <button key={p.id} type="button" className="mc-card cursor-pointer p-5 text-left transition-shadow hover:shadow-md" onClick={() => setSelectedId(p.id)}>
            <div className="flex items-center gap-3">
              <div className="mc-avatar" style={{ background: "#e8f5ee", color: "#2f8a4c" }}>{partnerInitials(p.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{p.name}</div>
                <div className="mt-0.5 flex gap-1.5"><TypeBadge t={p.type} /><StatBadge s={p.status} /></div>
              </div>
            </div>
            {p.notes ? <p className="mt-3 line-clamp-2 text-sm text-warmgray">{p.notes}</p> : null}
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche partenaire">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.name}</h2>
                <div className="mt-1 flex gap-1.5"><TypeBadge t={selected.type} /><StatBadge s={selected.status} /></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <dl className="flex flex-col gap-2.5 rounded-xl bg-white p-4 text-sm">
                {contactName(selected.contact_id) ? <div className="flex items-center gap-2"><User className="size-4 text-warmgray" /> {contactName(selected.contact_id)}</div> : null}
                {selected.email ? <div className="flex items-center gap-2"><Mail className="size-4 text-warmgray" /> <a href={`mailto:${selected.email}`} className="text-coral-dark hover:underline">{selected.email}</a></div> : null}
                {selected.phone ? <div className="flex items-center gap-2"><Phone className="size-4 text-warmgray" /> {selected.phone}</div> : null}
                {selected.website ? <div className="flex items-center gap-2"><Globe className="size-4 text-warmgray" /> <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-coral-dark hover:underline">{selected.website}</a></div> : null}
              </dl>
              {selected.notes ? <div><h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Notes</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.notes}</p></div> : null}
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <PartnerModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} partner={editing} persons={persons} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer ce partenaire ?"
        message={confirmDelete ? `« ${confirmDelete.name} » sera définitivement supprimé.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
