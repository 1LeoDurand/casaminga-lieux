"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import type { SaClient } from "@/lib/superadmin-billing/types";
import { saveSaClient, deleteSaClient } from "../actions";

type OrgOption = { id: string; name: string };

interface Form {
  id?: string;
  organization_id: string;
  name: string;
  email: string;
  address: string;
  siret: string;
  notes: string;
}

const blank: Form = { organization_id: "", name: "", email: "", address: "", siret: "", notes: "" };

export function ClientsView({ clients, organizations }: { clients: SaClient[]; organizations: OrgOption[] }) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? null;

  function save() {
    if (!form) return;
    if (!form.name.trim()) { setError("Le nom est obligatoire."); return; }
    setError(null);
    start(async () => {
      const res = await saveSaClient({
        id: form.id,
        organization_id: form.organization_id || null,
        name: form.name.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        siret: form.siret.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (!res.ok) setError(res.error ?? "Erreur");
      else setForm(null);
    });
  }
  function onDelete(id: string) {
    if (!confirm("Supprimer ce client ?")) return;
    start(async () => { const res = await deleteSaClient(id); if (!res.ok) alert(res.error); });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={() => { setError(null); setForm(blank); }}>
          <Plus className="size-4" /> Nouveau client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DDD6] bg-white/50 px-6 py-12 text-center text-sm text-warmgray">
          Aucun client. Ajoutez vos clients (associations Casa Minga ou structures externes).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5DDD6] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD6] text-left text-[11px] uppercase tracking-wide text-warmgray">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Asso liée</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[#F0E8E0] last:border-0">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-warmgray">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-warmgray">{orgName(c.organization_id) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="rounded p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => { setError(null); setForm({ id: c.id, organization_id: c.organization_id ?? "", name: c.name, email: c.email ?? "", address: c.address ?? "", siret: c.siret ?? "", notes: c.notes ?? "" }); }}><Pencil className="size-4" /></button>
                      <button type="button" className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={() => onDelete(c.id)} disabled={pending}><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="mc-modal-ov" role="presentation" onClick={() => !pending && setForm(null)}>
          <div className="mc-modal w-[480px] max-w-[95vw]" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-heading text-xl font-bold text-foreground">{form.id ? "Modifier le client" : "Nouveau client"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="mc-form-group">
                <label className="mc-form-label">Nom *</label>
                <input className="mc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Manufacture des Pays" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="mc-form-group">
                  <label className="mc-form-label">Email</label>
                  <input className="mc-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">SIRET</label>
                  <input className="mc-input" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
                </div>
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Adresse</label>
                <input className="mc-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Association Casa Minga liée (optionnel)</label>
                <select className="mc-input" value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                  <option value="">— Aucune (client externe) —</option>
                  {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Notes</label>
                <textarea className="mc-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {error && <p className="text-sm font-medium text-coral-dark">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setForm(null)} disabled={pending}>Annuler</button>
              <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={save} disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
