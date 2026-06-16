"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { formatEuros, type SaPricingItem } from "@/lib/superadmin-billing/types";
import { savePricingItem, deletePricingItem } from "../actions";

interface Form {
  id?: string;
  label: string;
  description: string;
  unit_ht: string;
  vat_rate: string;
  active: boolean;
  sort_order: string;
}

const blank: Form = { label: "", description: "", unit_ht: "0", vat_rate: "0", active: true, sort_order: "0" };

export function TarifsView({ items }: { items: SaPricingItem[] }) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!form) return;
    if (!form.label.trim()) { setError("Le libellé est obligatoire."); return; }
    setError(null);
    start(async () => {
      const res = await savePricingItem({
        id: form.id,
        label: form.label.trim(),
        description: form.description.trim() || null,
        unit_ht: Number(form.unit_ht) || 0,
        vat_rate: Number(form.vat_rate) || 0,
        active: form.active,
        sort_order: Number(form.sort_order) || 0,
      });
      if (!res.ok) setError(res.error ?? "Erreur");
      else setForm(null);
    });
  }
  function onDelete(id: string) {
    if (!confirm("Supprimer ce tarif ?")) return;
    start(async () => { const res = await deletePricingItem(id); if (!res.ok) alert(res.error); });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={() => { setError(null); setForm(blank); }}>
          <Plus className="size-4" /> Nouveau tarif
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DDD6] bg-white/50 px-6 py-12 text-center text-sm text-warmgray">
          Aucun tarif affiché. Ajoutez vos prestations récurrentes pour les insérer en un clic dans une facture.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5DDD6] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD6] text-left text-[11px] uppercase tracking-wide text-warmgray">
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">P.U. HT</th>
                <th className="px-4 py-3 text-right">TVA</th>
                <th className="px-4 py-3">Actif</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-[#F0E8E0] last:border-0">
                  <td className="px-4 py-3 font-semibold">{it.label}</td>
                  <td className="px-4 py-3 text-warmgray">{it.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatEuros(it.unit_ht)}</td>
                  <td className="px-4 py-3 text-right text-warmgray">{it.vat_rate}%</td>
                  <td className="px-4 py-3">{it.active ? "✓" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="rounded p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => { setError(null); setForm({ id: it.id, label: it.label, description: it.description ?? "", unit_ht: String(it.unit_ht), vat_rate: String(it.vat_rate), active: it.active, sort_order: String(it.sort_order) }); }}><Pencil className="size-4" /></button>
                      <button type="button" className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={() => onDelete(it.id)} disabled={pending}><Trash2 className="size-4" /></button>
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
              <h2 className="font-heading text-xl font-bold text-foreground">{form.id ? "Modifier le tarif" : "Nouveau tarif"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="mc-form-group">
                <label className="mc-form-label">Libellé *</label>
                <input className="mc-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Forfait mensuel — appui tiers-lieu" />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Description</label>
                <input className="mc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="mc-form-group">
                  <label className="mc-form-label">P.U. HT (€)</label>
                  <input className="mc-input" type="number" min="0" step="0.01" value={form.unit_ht} onChange={(e) => setForm({ ...form, unit_ht: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">TVA %</label>
                  <input className="mc-input" type="number" min="0" step="0.1" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Ordre</label>
                  <input className="mc-input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Actif (proposé dans l&apos;éditeur)</label>
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
