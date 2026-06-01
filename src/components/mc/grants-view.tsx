"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle, Euro, TrendingUp, Clock, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  createGrantAction, updateGrantAction, deleteGrantAction,
  createGrantTrancheAction, updateGrantTrancheAction, deleteGrantTrancheAction,
} from "@/app/(admin)/dashboard/[org]/subventions/actions";
import type { Grant, GrantTranche } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};

const STATUS_META: Record<Grant["status"], { label: string; color: string }> = {
  candidature: { label: "Candidature", color: "bg-blue-50 text-blue-700 border-blue-200" },
  accordee:    { label: "Accordée",    color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  en_cours:    { label: "En cours",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  solde:       { label: "Soldée",      color: "bg-slate-100 text-slate-500 border-slate-200" },
  refuse:      { label: "Refusée",     color: "bg-red-50 text-red-600 border-red-200" },
  annule:      { label: "Annulée",     color: "bg-slate-100 text-slate-400 border-slate-200" },
};

const FUNDER_TYPE_LABELS: Record<string, string> = {
  public: "Public",
  prive: "Privé",
  fondation: "Fondation",
  europe: "Europe",
};

const TRANCHE_STATUS_META: Record<GrantTranche["status"], { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "bg-amber-50 text-amber-700" },
  recu:       { label: "Reçu",       color: "bg-emerald-50 text-emerald-700" },
  en_retard:  { label: "En retard",  color: "bg-red-50 text-red-700" },
};

// ── Formulaire subvention ────────────────────────────────────
interface GrantFormValues {
  title: string; funder: string; funder_type: Grant["funder_type"];
  amount: string; amount_received: string;
  start_date: string; end_date: string; status: Grant["status"];
  convention_ref: string; description: string; reporting_due_date: string;
  kpi_beneficiaires: string; kpi_heures: string; kpi_artistes: string;
  kpi_evenements: string; kpi_note: string;
}

const EMPTY_FORM: GrantFormValues = {
  title: "", funder: "", funder_type: "public",
  amount: "", amount_received: "0",
  start_date: "", end_date: "", status: "en_cours",
  convention_ref: "", description: "", reporting_due_date: "",
  kpi_beneficiaires: "", kpi_heures: "", kpi_artistes: "", kpi_evenements: "", kpi_note: "",
};

function grantToForm(g: Grant): GrantFormValues {
  return {
    title: g.title, funder: g.funder, funder_type: g.funder_type,
    amount: String(g.amount), amount_received: String(g.amount_received),
    start_date: g.start_date ?? "", end_date: g.end_date ?? "",
    status: g.status, convention_ref: g.convention_ref ?? "",
    description: g.description ?? "", reporting_due_date: g.reporting_due_date ?? "",
    kpi_beneficiaires: g.kpi_beneficiaires != null ? String(g.kpi_beneficiaires) : "",
    kpi_heures: g.kpi_heures != null ? String(g.kpi_heures) : "",
    kpi_artistes: g.kpi_artistes != null ? String(g.kpi_artistes) : "",
    kpi_evenements: g.kpi_evenements != null ? String(g.kpi_evenements) : "",
    kpi_note: g.kpi_note ?? "",
  };
}

function formToInput(f: GrantFormValues, orgId: string) {
  return {
    organization_id: orgId,
    title: f.title.trim(), funder: f.funder.trim(), funder_type: f.funder_type,
    amount: parseFloat(f.amount) || 0,
    amount_received: parseFloat(f.amount_received) || 0,
    start_date: f.start_date || null, end_date: f.end_date || null,
    status: f.status, convention_ref: f.convention_ref.trim() || null,
    description: f.description.trim() || null,
    reporting_due_date: f.reporting_due_date || null,
    kpi_beneficiaires: f.kpi_beneficiaires ? parseInt(f.kpi_beneficiaires) : null,
    kpi_heures: f.kpi_heures ? parseInt(f.kpi_heures) : null,
    kpi_artistes: f.kpi_artistes ? parseInt(f.kpi_artistes) : null,
    kpi_evenements: f.kpi_evenements ? parseInt(f.kpi_evenements) : null,
    kpi_note: f.kpi_note.trim() || null,
  };
}

// ── Champ de formulaire ──────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";
const selectCls = inputCls + " cursor-pointer";

// ── Drawer formulaire ────────────────────────────────────────
function GrantDrawer({
  open, onClose, orgId, orgSlug, editing,
}: {
  open: boolean; onClose: () => void; orgId: string; orgSlug: string; editing: Grant | null;
}) {
  const [form, setForm] = useState<GrantFormValues>(editing ? grantToForm(editing) : EMPTY_FORM);
  const [tab, setTab] = useState<"info" | "kpi">("info");
  const [pending, start] = useTransition();

  // Reset quand editing change
  useState(() => { setForm(editing ? grantToForm(editing) : EMPTY_FORM); });

  const set = (k: keyof GrantFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.funder.trim()) return;
    const input = formToInput(form, orgId);
    start(async () => {
      const ok = editing
        ? (await updateGrantAction(orgSlug, editing.id, input)).ok
        : (await createGrantAction(orgSlug, input)).ok;
      if (ok) { toast.success(editing ? "Subvention mise à jour" : "Subvention créée"); onClose(); }
      else toast.error("Une erreur est survenue");
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {editing ? "Modifier la subvention" : "Nouvelle subvention"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-100 px-6">
          {(["info", "kpi"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t === "info" ? "Informations" : "KPI & reporting"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-6">
            {tab === "info" && (
              <>
                <Field label="Titre *"><input required value={form.title} onChange={set("title")} placeholder="ex : Subvention DRAC 2025" className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Financeur *"><input required value={form.funder} onChange={set("funder")} placeholder="ex : DRAC Bretagne" className={inputCls} /></Field>
                  <Field label="Type">
                    <select value={form.funder_type} onChange={set("funder_type")} className={selectCls}>
                      {Object.entries(FUNDER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Montant accordé (€) *"><input required type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0" className={inputCls} /></Field>
                  <Field label="Montant reçu (€)"><input type="number" min="0" step="0.01" value={form.amount_received} onChange={set("amount_received")} placeholder="0" className={inputCls} /></Field>
                </div>
                <Field label="Statut">
                  <select value={form.status} onChange={set("status")} className={selectCls}>
                    {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date de début"><input type="date" value={form.start_date} onChange={set("start_date")} className={inputCls} /></Field>
                  <Field label="Date de fin"><input type="date" value={form.end_date} onChange={set("end_date")} className={inputCls} /></Field>
                </div>
                <Field label="N° convention"><input value={form.convention_ref} onChange={set("convention_ref")} placeholder="ex : 2025-DRAC-042" className={inputCls} /></Field>
                <Field label="Rapport dû le"><input type="date" value={form.reporting_due_date} onChange={set("reporting_due_date")} className={inputCls} /></Field>
                <Field label="Description">
                  <textarea rows={3} value={form.description} onChange={set("description")} placeholder="Objet de la subvention…" className={inputCls + " resize-none"} />
                </Field>
              </>
            )}
            {tab === "kpi" && (
              <>
                <p className="text-xs text-slate-500">Ces indicateurs alimentent le rapport d'impact remis aux financeurs.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bénéficiaires touchés"><input type="number" min="0" value={form.kpi_beneficiaires} onChange={set("kpi_beneficiaires")} placeholder="0" className={inputCls} /></Field>
                  <Field label="Heures d'activité"><input type="number" min="0" value={form.kpi_heures} onChange={set("kpi_heures")} placeholder="0" className={inputCls} /></Field>
                  <Field label="Artistes accueillis"><input type="number" min="0" value={form.kpi_artistes} onChange={set("kpi_artistes")} placeholder="0" className={inputCls} /></Field>
                  <Field label="Événements réalisés"><input type="number" min="0" value={form.kpi_evenements} onChange={set("kpi_evenements")} placeholder="0" className={inputCls} /></Field>
                </div>
                <Field label="Notes complémentaires">
                  <textarea rows={4} value={form.kpi_note} onChange={set("kpi_note")} placeholder="Contexte, méthodologie, observations…" className={inputCls + " resize-none"} />
                </Field>
              </>
            )}
          </div>

          <div className="mt-auto border-t border-slate-100 px-6 py-4">
            <button type="submit" disabled={pending}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
              {pending ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer la subvention"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Ligne subvention avec tranches ───────────────────────────
function GrantRow({
  grant, tranches, orgSlug,
  onEdit, onDelete,
}: {
  grant: Grant; tranches: GrantTranche[]; orgSlug: string;
  onEdit: (g: Grant) => void; onDelete: (g: Grant) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [trancheForm, setTrancheForm] = useState({ label: "", amount: "", due_date: "", status: "en_attente" as GrantTranche["status"] });
  const [addingTranche, setAddingTranche] = useState(false);
  const [pending, start] = useTransition();

  const pct = grant.amount > 0 ? Math.min(100, Math.round((grant.amount_received / grant.amount) * 100)) : 0;
  const meta = STATUS_META[grant.status];
  const days = daysUntil(grant.reporting_due_date);
  const reportingAlert = days !== null && days >= 0 && days <= 30;

  async function handleAddTranche() {
    if (!trancheForm.label.trim() || !trancheForm.amount) return;
    start(async () => {
      const ok = (await createGrantTrancheAction(orgSlug, {
        grant_id: grant.id,
        label: trancheForm.label.trim(),
        amount: parseFloat(trancheForm.amount),
        due_date: trancheForm.due_date || null,
        received_date: null,
        status: trancheForm.status,
      })).ok;
      if (ok) { toast.success("Tranche ajoutée"); setAddingTranche(false); setTrancheForm({ label: "", amount: "", due_date: "", status: "en_attente" }); }
      else toast.error("Erreur");
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* En-tête */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{grant.title}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>{meta.label}</span>
            {reportingAlert && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700">
                <AlertTriangle className="size-3" />
                Rapport dans {days}j
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span>{grant.funder}</span>
            <span>·</span>
            <span className="font-medium text-slate-700">{fmt(grant.amount)}</span>
            {grant.convention_ref && <><span>·</span><span>{grant.convention_ref}</span></>}
          </div>
          {/* Barre de progression */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 shrink-0">{fmt(grant.amount_received)} reçu ({pct}%)</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onEdit(grant)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="size-4" /></button>
          <button onClick={() => onDelete(grant)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
          <button onClick={() => setExpanded((v) => !v)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {/* Détail expandé */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* KPI */}
          {(grant.kpi_beneficiaires || grant.kpi_heures || grant.kpi_artistes || grant.kpi_evenements) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Bénéficiaires", val: grant.kpi_beneficiaires },
                { label: "Heures", val: grant.kpi_heures },
                { label: "Artistes", val: grant.kpi_artistes },
                { label: "Événements", val: grant.kpi_evenements },
              ].filter((k) => k.val != null).map((k) => (
                <div key={k.label} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-slate-800">{k.val}</div>
                  <div className="text-[10px] text-slate-500">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dates */}
          {(grant.start_date || grant.end_date || grant.reporting_due_date) && (
            <div className="flex gap-4 text-xs text-slate-500">
              {grant.start_date && <span>Début : {fmtDate(grant.start_date)}</span>}
              {grant.end_date && <span>Fin : {fmtDate(grant.end_date)}</span>}
              {grant.reporting_due_date && <span className={reportingAlert ? "font-semibold text-red-600" : ""}>Rapport : {fmtDate(grant.reporting_due_date)}</span>}
            </div>
          )}

          {/* Tranches */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Tranches de versement</span>
              <button onClick={() => setAddingTranche((v) => !v)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                <Plus className="size-3" /> Ajouter
              </button>
            </div>
            {tranches.length === 0 && !addingTranche && <p className="text-xs text-slate-400">Aucune tranche définie.</p>}
            {tranches.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TRANCHE_STATUS_META[t.status].color}`}>{TRANCHE_STATUS_META[t.status].label}</span>
                  <span className="text-xs text-slate-700">{t.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{fmt(t.amount)}</span>
                  {t.due_date && <span>{fmtDate(t.due_date)}</span>}
                  <button onClick={() => start(async () => { await deleteGrantTrancheAction(orgSlug, t.id); })}
                    className="text-slate-300 hover:text-red-500"><Trash2 className="size-3" /></button>
                </div>
              </div>
            ))}
            {addingTranche && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input value={trancheForm.label} onChange={(e) => setTrancheForm((f) => ({ ...f, label: e.target.value }))} placeholder="Libellé" className={inputCls + " col-span-1"} />
                <input type="number" value={trancheForm.amount} onChange={(e) => setTrancheForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Montant €" className={inputCls} />
                <input type="date" value={trancheForm.due_date} onChange={(e) => setTrancheForm((f) => ({ ...f, due_date: e.target.value }))} className={inputCls} />
                <select value={trancheForm.status} onChange={(e) => setTrancheForm((f) => ({ ...f, status: e.target.value as GrantTranche["status"] }))} className={selectCls + " col-span-2"}>
                  <option value="en_attente">En attente</option>
                  <option value="recu">Reçu</option>
                  <option value="en_retard">En retard</option>
                </select>
                <button onClick={handleAddTranche} disabled={pending} className="rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                  {pending ? "…" : "Ajouter"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────
export function GrantsView({ grants, orgSlug, orgId }: {
  grants: Grant[]; orgSlug: string; orgId: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Grant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Grant | null>(null);
  const [statusF, setStatusF] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  // Tranches chargées côté client via state (vide au départ, on expand pour voir)
  const tranchesByGrant: Record<string, GrantTranche[]> = {};

  const filtered = useMemo(() => grants.filter((g) => {
    if (statusF !== "all" && g.status !== statusF) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase()) && !g.funder.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [grants, statusF, search]);

  // KPI globaux
  const totalAccorde = grants.reduce((s, g) => s + g.amount, 0);
  const totalRecu = grants.reduce((s, g) => s + g.amount_received, 0);
  const totalEnAttente = totalAccorde - totalRecu;
  const alertes = grants.filter((g) => { const d = daysUntil(g.reporting_due_date); return d !== null && d >= 0 && d <= 30; });

  function openCreate() { setEditing(null); setDrawerOpen(true); }
  function openEdit(g: Grant) { setEditing(g); setDrawerOpen(true); }

  async function handleDelete() {
    if (!confirmDelete) return;
    start(async () => {
      const ok = (await deleteGrantAction(orgSlug, confirmDelete.id)).ok;
      if (ok) toast.success("Subvention supprimée");
      else toast.error("Erreur lors de la suppression");
      setConfirmDelete(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: <Euro className="size-4" />, label: "Total accordé", value: fmt(totalAccorde), color: "text-slate-700" },
          { icon: <CheckCircle2 className="size-4" />, label: "Reçu", value: fmt(totalRecu), color: "text-emerald-600" },
          { icon: <Clock className="size-4" />, label: "En attente", value: fmt(totalEnAttente), color: "text-amber-600" },
          { icon: <AlertTriangle className="size-4" />, label: "Rapports < 30j", value: String(alertes.length), color: alertes.length > 0 ? "text-red-600" : "text-slate-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={`mb-1 ${k.color}`}>{k.icon}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alertes reporting */}
      {alertes.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-red-600" />
            <span className="text-sm font-semibold text-red-800">Rapports à remettre bientôt</span>
          </div>
          <ul className="space-y-1">
            {alertes.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-xs text-red-700">
                <span>{g.title} — {g.funder}</span>
                <span className="font-semibold">Dans {daysUntil(g.reporting_due_date)}j ({fmtDate(g.reporting_due_date)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-56" />
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <button onClick={openCreate}
          className="ml-auto flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          <Plus className="size-4" /> Nouvelle subvention
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          <TrendingUp className="mx-auto mb-3 size-8 opacity-30" />
          <p className="text-sm">{grants.length === 0 ? "Aucune subvention enregistrée." : "Aucun résultat."}</p>
          {grants.length === 0 && (
            <button onClick={openCreate} className="mt-3 text-sm text-slate-600 underline underline-offset-2">Ajouter votre première subvention</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((g) => (
            <GrantRow key={g.id} grant={g} tranches={tranchesByGrant[g.id] ?? []} orgSlug={orgSlug}
              onEdit={openEdit} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      <GrantDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} orgId={orgId} orgSlug={orgSlug} editing={editing} key={editing?.id ?? "new"} />
      <ConfirmDialog open={!!confirmDelete} title="Supprimer la subvention"
        message={`Supprimer « ${confirmDelete?.title} » ? Cette action est irréversible.`}
        tone="danger" busy={pending}
        onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
