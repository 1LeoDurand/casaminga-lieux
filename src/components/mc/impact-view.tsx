"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, TrendingUp, CalendarCheck, Users, Building2, Wallet, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { KpiTile } from "@/components/mc/kpi-tile";
import { IMPACT_CATEGORIES, impactCategoryLabel, impactCategoryBadge, impactCategoryColor, formatIndicator } from "@/lib/impact-meta";
import { createImpactAction, updateImpactAction, deleteImpactAction } from "@/app/(admin)/dashboard/[org]/impact/actions";
import type { ImpactIndicator } from "@/lib/types";

export interface AutoStats {
  reservations: number; reservationsConfirmees: number;
  evenements: number; evenementsPublies: number;
  personnes: number; espaces: number;
  recettes: number; depenses: number;
}

interface FV { label: string; value: string; unit: string; period: string; category: ImpactIndicator["category"]; }
function fromIndicator(i: ImpactIndicator | null): FV {
  return { label: i?.label ?? "", value: i != null ? String(i.value) : "", unit: i?.unit ?? "", period: i?.period ?? "", category: i?.category ?? "autre" };
}
function IndicatorModal({ open, indicator, busy, onSubmit, onClose }: {
  open: boolean; indicator: ImpactIndicator | null; busy: boolean; onSubmit: (v: FV) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FV>(fromIndicator(indicator));
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof FV>(k: K, val: FV[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.label.trim()) { setError("Le libellé est obligatoire."); return; }
    const n = Number(v.value.trim().replace(",", "."));
    if (v.value.trim() === "" || Number.isNaN(n)) { setError("La valeur doit être un nombre."); return; }
    onSubmit({ ...v, label: v.label.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{indicator ? "Modifier l'indicateur" : "Nouvel indicateur"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Libellé *</label>
            <input className="mc-input" value={v.label} autoFocus onChange={(e) => set("label", e.target.value)} placeholder="Visiteurs accueillis, déchets recyclés…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Valeur *</label>
              <input className="mc-input" inputMode="decimal" value={v.value} onChange={(e) => set("value", e.target.value)} placeholder="ex. 3200" /></div>
            <div className="mc-form-group"><label className="mc-form-label">Unité</label>
              <input className="mc-input" value={v.unit} onChange={(e) => set("unit", e.target.value)} placeholder="pers., %, kg…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Période</label>
              <input className="mc-input" value={v.period} onChange={(e) => set("period", e.target.value)} placeholder="2026, T1 2026…" /></div>
            <div className="mc-form-group"><label className="mc-form-label">Catégorie</label>
              <select className="mc-input" value={v.category} onChange={(e) => set("category", e.target.value as ImpactIndicator["category"])}>
                {IMPACT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
          </div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : indicator ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

export function ImpactView({ indicators, auto, orgSlug, orgId }: {
  indicators: ImpactIndicator[]; auto: AutoStats; orgSlug: string; orgId: string;
}) {
  const [catF, setCatF] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ImpactIndicator | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ImpactIndicator | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => indicators.filter((i) => catF.size === 0 || catF.has(i.category)), [indicators, catF]);

  const autoCards = [
    { icon: <CalendarCheck className="size-[18px]" />, bg: "#ffefea", color: "var(--coral-dark)", value: auto.reservationsConfirmees, label: "Réservations confirmées", sub: `${auto.reservations} au total` },
    { icon: <Sparkles className="size-[18px]" />, bg: "#f4e7ff", color: "#6b3aa0", value: auto.evenementsPublies, label: "Événements publiés", sub: `${auto.evenements} programmés` },
    { icon: <Users className="size-[18px]" />, bg: "#e5f4f7", color: "#0a6b78", value: auto.personnes, label: "Personnes au CRM", sub: "communauté du lieu" },
    { icon: <Building2 className="size-[18px]" />, bg: "#e8f5ee", color: "#2f8a4c", value: auto.espaces, label: "Espaces au catalogue", sub: "lieux mobilisables" },
    { icon: <Wallet className="size-[18px]" />, bg: "#fff5f0", color: "var(--coral-dark)", value: `${(auto.recettes - auto.depenses).toLocaleString("fr-FR")} €`, label: "Solde net", sub: `${auto.recettes.toLocaleString("fr-FR")} € de recettes` },
  ];

  function toggle(v: string) { setCatF((s) => { const n = new Set(s); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n; }); }

  function submitForm(v: FV) {
    const payload = { label: v.label, value: Number(v.value.replace(",", ".")), unit: v.unit.trim() || null, period: v.period.trim() || null, category: v.category };
    startTransition(async () => {
      const res = editing ? await updateImpactAction(orgSlug, editing.id, payload) : await createImpactAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Indicateur mis à jour" : "Indicateur créé"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible.");
    });
  }
  function doDelete(i: ImpactIndicator) {
    startTransition(async () => {
      const { ok } = await deleteImpactAction(orgSlug, i.id);
      if (ok) { toast.success("Indicateur supprimé"); setConfirmDelete(null); } else toast.error("Suppression impossible.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Indicateurs automatiques (agrégés) */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-4 text-warmgray" />
          <h3 className="text-sm font-semibold text-foreground">Indicateurs automatiques</h3>
          <span className="text-[11px] text-warmgray">— agrégés en temps réel depuis vos modules</span>
        </div>
        <div className="mc-kpi-row">
          {autoCards.map((c, i) => (
            <KpiTile key={i} icon={c.icon} iconBg={c.bg} iconColor={c.color} value={c.value} caption={c.label} trend={c.sub} />
          ))}
        </div>
      </div>

      {/* Indicateurs manuels */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-warmgray" />
            <h3 className="text-sm font-semibold text-foreground">Indicateurs manuels</h3>
            <span className="text-[11px] text-warmgray">— saisis pour vos bilans et subventions</span>
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvel indicateur</button>
        </div>

        <div className="mb-4 mc-chips">
          {IMPACT_CATEGORIES.map((c) => (
            <button key={c.value} type="button" className={`mc-chip ${catF.has(c.value) ? "active" : ""}`} onClick={() => toggle(c.value)}>{c.label}</button>
          ))}
        </div>

        {indicators.length === 0 ? (
          <div className="mc-card"><div className="mc-empty">
            <span className="mc-empty-ic"><TrendingUp className="size-6" strokeWidth={1.8} /></span>
            <div className="mc-empty-title">Aucun indicateur manuel</div>
            <p className="mc-empty-sub">Saisissez vos indicateurs de fréquentation, diversité, environnement, économie.</p>
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvel indicateur</button>
          </div></div>
        ) : (
          <div className="mc-cards-grid">
            {filtered.map((i) => (
              <div key={i.id} className="mc-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className={`mc-badge ${impactCategoryBadge(i.category)}`}>{impactCategoryLabel(i.category)}</span>
                  <div className="flex gap-1">
                    <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => { setEditing(i); setFormOpen(true); }}><Pencil className="size-4" /></button>
                    <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => setConfirmDelete(i)}><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <div className="mt-3 font-heading text-3xl font-bold" style={{ color: impactCategoryColor(i.category) }}>{formatIndicator(i.value, i.unit)}</div>
                <div className="mt-1 text-sm font-medium text-foreground">{i.label}</div>
                {i.period ? <div className="mt-1 text-[12px] text-warmgray">{i.period}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <IndicatorModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} indicator={editing} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cet indicateur ?"
        message={confirmDelete ? `« ${confirmDelete.label} » sera définitivement supprimé.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
