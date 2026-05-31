"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, Zap, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, triggerLabel, triggerBadge, actionLabel, formatLastRun,
} from "@/lib/automations-meta";
import { createAutomationAction, updateAutomationAction, deleteAutomationAction } from "@/app/(admin)/dashboard/[org]/automatisations/actions";
import type { Automation } from "@/lib/types";

interface FV { name: string; triggerType: Automation["trigger_type"]; condition: string; actionType: Automation["action_type"]; actionDetail: string; active: boolean; }
function fromAuto(a: Automation | null): FV {
  return { name: a?.name ?? "", triggerType: a?.trigger_type ?? "manuel", condition: a?.condition ?? "",
    actionType: a?.action_type ?? "notification", actionDetail: a?.action_detail ?? "", active: a?.active ?? true };
}
function AutomationModal({ open, automation, busy, onSubmit, onClose }: {
  open: boolean; automation: Automation | null; busy: boolean; onSubmit: (v: FV) => void; onClose: () => void;
}) {
  const [v, setV] = useState<FV>(fromAuto(automation));
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof FV>(k: K, val: FV[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() { if (!v.name.trim()) { setError("Le nom est obligatoire."); return; } onSubmit({ ...v, name: v.name.trim() }); }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{automation ? "Modifier la règle" : "Nouvelle règle"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Nom de la règle *</label>
            <input className="mc-input" value={v.name} autoFocus onChange={(e) => set("name", e.target.value)} placeholder="Accusé de réception, relance impayés…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Déclencheur (SI)</label>
            <select className="mc-input" value={v.triggerType} onChange={(e) => set("triggerType", e.target.value as Automation["trigger_type"])}>
              {AUTOMATION_TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div className="mc-form-group"><label className="mc-form-label">Condition</label>
            <input className="mc-input" value={v.condition} onChange={(e) => set("condition", e.target.value)} placeholder="ex. Facture impayée depuis plus de 30 jours" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Action (ALORS)</label>
            <select className="mc-input" value={v.actionType} onChange={(e) => set("actionType", e.target.value as Automation["action_type"])}>
              {AUTOMATION_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select></div>
          <div className="mc-form-group"><label className="mc-form-label">Détail de l&apos;action</label>
            <textarea className="mc-textarea" value={v.actionDetail} onChange={(e) => set("actionDetail", e.target.value)} placeholder="ex. Envoyer un email de confirmation au demandeur" /></div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-[var(--coral)]" />
            Règle active
          </label>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : automation ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

export function AutomatisationsView({ automations, orgSlug, orgId }: {
  automations: Automation[]; orgSlug: string; orgId: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Automation | null>(null);
  const [pending, startTransition] = useTransition();

  const kpis = useMemo(() => ({
    total: automations.length,
    actives: automations.filter((a) => a.active).length,
    executions: automations.reduce((s, a) => s + a.run_count, 0),
  }), [automations]);

  function submitForm(v: FV) {
    const payload = { name: v.name, trigger_type: v.triggerType, condition: v.condition.trim() || null,
      action_type: v.actionType, action_detail: v.actionDetail.trim() || null, active: v.active };
    startTransition(async () => {
      const res = editing ? await updateAutomationAction(orgSlug, editing.id, payload) : await createAutomationAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Règle mise à jour" : "Règle créée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible.");
    });
  }
  function toggleActive(a: Automation) {
    startTransition(async () => {
      const res = await updateAutomationAction(orgSlug, a.id, { active: !a.active });
      if (res.ok) toast.success(a.active ? "Règle désactivée" : "Règle activée");
      else toast.error("Action impossible.");
    });
  }
  function doDelete(a: Automation) {
    startTransition(async () => {
      const { ok } = await deleteAutomationAction(orgSlug, a.id);
      if (ok) { toast.success("Règle supprimée"); setConfirmDelete(null); } else toast.error("Suppression impossible.");
    });
  }

  if (automations.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Zap className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucune automatisation</div>
        <p className="mc-empty-sub">Créez des règles « si… alors… » pour automatiser relances, confirmations et rappels.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle règle</button>
      </div></div>
      <AutomationModal open={formOpen} automation={null} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Règles</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.actives}</div><div className="mc-stat-lbl">Actives</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.executions}</div><div className="mc-stat-lbl">Exécutions cumulées</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-[12px] text-warmgray">Les règles décrivent le comportement souhaité. Leur exécution réelle relève de la logique serveur (jamais de secret côté navigateur).</p>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle règle</button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {automations.map((a) => (
          <div key={a.id} className={`mc-card px-5 py-4 ${a.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="size-4" style={{ color: a.active ? "var(--coral-dark)" : "var(--warmgray)" }} />
                  <span className="font-semibold text-foreground">{a.name}</span>
                  <span className={`mc-badge ${a.active ? "mc-badge-green" : "mc-badge-gray"}`}>{a.active ? "Active" : "Inactive"}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-warmgray">
                  <span className={`mc-badge ${triggerBadge(a.trigger_type)}`}>{triggerLabel(a.trigger_type)}</span>
                  {a.condition ? <span>· {a.condition}</span> : null}
                  <ArrowRight className="size-3.5" />
                  <span className="font-medium text-foreground">{actionLabel(a.action_type)}</span>
                  {a.action_detail ? <span>· {a.action_detail}</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-warmgray">
                  <Play className="size-3" /> {formatLastRun(a.last_run_at)} · {a.run_count} exécution{a.run_count > 1 ? "s" : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" disabled={pending} className={`mc-btn mc-btn-sm ${a.active ? "mc-btn-outline" : "mc-btn-lime"}`} onClick={() => toggleActive(a)}>{a.active ? "Désactiver" : "Activer"}</button>
                <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => { setEditing(a); setFormOpen(true); }}><Pencil className="size-4" /></button>
                <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => setConfirmDelete(a)}><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AutomationModal key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} automation={editing} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette règle ?"
        message={confirmDelete ? `« ${confirmDelete.name} » sera définitivement supprimée.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
