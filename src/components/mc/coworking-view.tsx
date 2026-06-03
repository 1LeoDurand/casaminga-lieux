"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Play, X } from "lucide-react";
import { type CoworkingSubscription, formatEuros } from "@/lib/invoicing/types";
import {
  saveSubscription,
  deleteSubscription,
  generateNow,
  type SubscriptionInput,
} from "@/app/(admin)/dashboard/[org]/factures/coworking/actions";

interface PersonLite { id: string; name: string; email: string | null }

const input =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

const EMPTY: SubscriptionInput = {
  person_id: null, client_name: "", client_email: "", client_address: "",
  designation: "", monthly_amount_ht: 0, vat_applicable: false, vat_rate: 0,
  day_of_month: 1, active: true, start_date: null, end_date: null,
};

export function CoworkingView({
  subscriptions,
  persons,
  orgId,
  orgSlug,
}: {
  subscriptions: CoworkingSubscription[];
  persons: PersonLite[];
  orgId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CoworkingSubscription | "new" | null>(null);

  const totals = useMemo(() => {
    const active = subscriptions.filter((s) => s.active);
    const monthly = active.reduce((sum, s) => {
      const ht = Number(s.monthly_amount_ht) || 0;
      const ttc = s.vat_applicable ? ht * (1 + (Number(s.vat_rate) || 0) / 100) : ht;
      return sum + ttc;
    }, 0);
    return { activeCount: active.length, monthly };
  }, [subscriptions]);

  function runGenerate() {
    if (!confirm("Générer les factures du mois pour tous les coworkers actifs et les envoyer par email ?")) return;
    startTransition(async () => {
      const res = await generateNow(orgId, orgSlug);
      if (res.ok) { toast.success(res.summary ?? "Factures générées ✓"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Supprimer l'abonnement de ${name} ? Les factures déjà émises sont conservées.`)) return;
    startTransition(async () => {
      const res = await deleteSubscription(orgSlug, id);
      if (res.ok) { toast.success("Abonnement supprimé"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Barre récap + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4">
        <div className="text-sm">
          <span className="font-bold text-ink">{totals.activeCount}</span>
          <span className="text-warmgray"> coworker(s) actif(s) · </span>
          <span className="font-bold text-ink">{formatEuros(totals.monthly)}</span>
          <span className="text-warmgray"> facturés / mois</span>
        </div>
        <div className="flex gap-2">
          <button onClick={runGenerate} disabled={pending || totals.activeCount === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-50">
            <Play className="size-3.5" /> {pending ? "Génération…" : "Générer ce mois maintenant"}
          </button>
          <button onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white hover:bg-coral-dark">
            <Plus className="size-4" /> Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      {subscriptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Aucun coworker. Cliquez sur <strong>Ajouter</strong> pour enregistrer le premier.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1.4fr_1.6fr_0.8fr_0.6fr_0.6fr_auto] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Coworker</span><span>Email</span><span>Tarif/mois</span><span>Le</span><span>Statut</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {subscriptions.map((s) => {
              const ttc = s.vat_applicable
                ? (Number(s.monthly_amount_ht) || 0) * (1 + (Number(s.vat_rate) || 0) / 100)
                : Number(s.monthly_amount_ht) || 0;
              return (
                <li key={s.id} className="grid grid-cols-1 gap-1.5 px-5 py-3.5 md:grid-cols-[1.4fr_1.6fr_0.8fr_0.6fr_0.6fr_auto] md:items-center md:gap-4">
                  <span className="text-[13.5px] font-semibold text-ink">{s.client_name}</span>
                  <span className="truncate text-[12.5px] text-warmgray">{s.client_email ?? "—"}</span>
                  <span className="text-[13.5px] font-semibold text-ink">
                    {formatEuros(ttc)}{s.vat_applicable ? <span className="text-[11px] font-normal text-warmgray"> TTC</span> : ""}
                  </span>
                  <span className="text-[12.5px] text-warmgray">{s.day_of_month} du mois</span>
                  <span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {s.active ? "Actif" : "Inactif"}
                    </span>
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-warmgray hover:text-coral-dark" title="Modifier"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(s.id, s.client_name)} className="rounded-lg p-2 text-warmgray hover:text-red-600" title="Supprimer"><Trash2 className="size-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-[12px] text-warmgray">
        ⚙️ Automatique : le 1er de chaque mois, une facture est générée pour chaque coworker actif (selon son jour) et envoyée par email avec le PDF.
      </p>

      {editing && (
        <SubscriptionModal
          orgId={orgId}
          orgSlug={orgSlug}
          persons={persons}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SubscriptionModal({
  orgId, orgSlug, persons, existing, onClose, onSaved,
}: {
  orgId: string; orgSlug: string; persons: PersonLite[];
  existing: CoworkingSubscription | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<SubscriptionInput>(
    existing
      ? {
          person_id: existing.person_id, client_name: existing.client_name,
          client_email: existing.client_email ?? "", client_address: existing.client_address ?? "",
          designation: existing.designation ?? "", monthly_amount_ht: existing.monthly_amount_ht,
          vat_applicable: existing.vat_applicable, vat_rate: existing.vat_rate,
          day_of_month: existing.day_of_month, active: existing.active,
          start_date: existing.start_date, end_date: existing.end_date,
        }
      : { ...EMPTY }
  );

  function set<K extends keyof SubscriptionInput>(k: K, v: SubscriptionInput[K]) {
    setF((cur) => ({ ...cur, [k]: v }));
  }
  function pick(id: string) {
    if (!id) { set("person_id", null); return; }
    const p = persons.find((x) => x.id === id);
    if (p) { set("person_id", p.id); set("client_name", p.name); if (p.email) set("client_email", p.email); }
  }
  function submit() {
    startTransition(async () => {
      const res = await saveSubscription(orgId, orgSlug, f, existing?.id);
      if (res.ok) { toast.success("Enregistré ✓"); onSaved(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">{existing ? "Modifier" : "Nouveau coworker"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Depuis le CRM (optionnel)</label>
            <select className={input} value={f.person_id ?? ""} onChange={(e) => pick(e.target.value)}>
              <option value="">— Saisir manuellement —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Nom *</label><input className={input} value={f.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input className={input} value={f.client_email ?? ""} onChange={(e) => set("client_email", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Adresse</label><input className={input} value={f.client_address ?? ""} onChange={(e) => set("client_address", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Désignation sur la facture</label><input className={input} value={f.designation ?? ""} onChange={(e) => set("designation", e.target.value)} placeholder="Coworking — {mois} (auto si vide)" /></div>
          <div><label className={labelCls}>Tarif mensuel HT (€) *</label><input type="number" min={0} step="0.01" className={input} value={f.monthly_amount_ht} onChange={(e) => set("monthly_amount_ht", Number(e.target.value))} /></div>
          <div><label className={labelCls}>Jour de facturation</label><input type="number" min={1} max={28} className={input} value={f.day_of_month} onChange={(e) => set("day_of_month", Number(e.target.value))} /></div>
          <div className="sm:col-span-2 flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={f.vat_applicable} onChange={(e) => set("vat_applicable", e.target.checked)} className="size-4 accent-coral" /> TVA applicable
            </label>
            {f.vat_applicable && (
              <select className={`${input} w-28`} value={f.vat_rate} onChange={(e) => set("vat_rate", Number(e.target.value))}>
                {[0, 2.1, 5.5, 10, 20].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            )}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-coral" /> Actif
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending || !f.client_name.trim()} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
