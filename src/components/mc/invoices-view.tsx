"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Check, Send, Ban, Eye, Tag, BellRing, ShieldCheck, ShieldX } from "lucide-react";
import {
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
  STATUS_META,
  PAYMENT_METHODS,
  formatEuros,
} from "@/lib/invoicing/types";
import { setInvoiceStatus, relanceInvoice, setInvoiceValidation } from "@/app/(admin)/dashboard/[org]/factures/actions";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "brouillon", label: "Brouillons" },
  { key: "emise", label: "Émises" },
  { key: "envoyee", label: "Envoyées" },
  { key: "payee", label: "Payées" },
  { key: "arelancer", label: "À relancer" },
  { key: "avalider", label: "À valider" },
];

function isOverdue(inv: Invoice): boolean {
  if (!inv.number || inv.status === "payee" || inv.status === "annulee") return false;
  if (!inv.due_date) return false;
  return new Date(inv.due_date) < new Date(new Date().toISOString().slice(0, 10));
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const PM_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, `${m.emoji} ${m.label}`]));

export function InvoicesView({ invoices, orgSlug, validatorName = "" }: { invoices: Invoice[]; orgSlug: string; validatorName?: string }) {
  const [filter, setFilter] = useState("all");
  const [poleFilter, setPoleFilter] = useState("all");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ id: string; name: string } | null>(null);
  const [payMethod, setPayMethod] = useState<string>("");

  const poles = useMemo(() => {
    const set = new Set(invoices.map((i) => i.pole).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [invoices]);

  const kpis = useMemo(() => {
    const emitted = invoices.filter((i) => i.number);
    const totalEmitted = emitted.reduce((s, i) => s + i.total_ttc, 0);
    const paid = invoices.filter((i) => i.status === "payee").reduce((s, i) => s + i.total_ttc, 0);
    const unpaid = emitted
      .filter((i) => i.status !== "payee" && i.status !== "annulee")
      .reduce((s, i) => s + i.total_ttc, 0);
    return { count: emitted.length, totalEmitted, paid, unpaid };
  }, [invoices]);

  // Récap recettes par pôle (factures payées uniquement)
  const recapByPole = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status !== "payee" || !inv.number) continue;
      const key = inv.pole ?? "Sans pôle";
      map.set(key, (map.get(key) ?? 0) + inv.total_ttc);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  const filtered = useMemo(() => {
    let list: Invoice[];
    if (filter === "arelancer") list = invoices.filter(isOverdue);
    else if (filter === "avalider") list = invoices.filter((i) => i.validation_status === "a_valider");
    else if (filter === "all") list = invoices;
    else list = invoices.filter((i) => i.status === filter);
    if (poleFilter !== "all") list = list.filter((i) => (i.pole ?? "sans-pole") === poleFilter);
    return list;
  }, [invoices, filter, poleFilter]);

  const toRelanceCount = useMemo(() => invoices.filter(isOverdue).length, [invoices]);
  const toValidateCount = useMemo(() => invoices.filter((i) => i.validation_status === "a_valider").length, [invoices]);

  function changeStatus(id: string, status: "payee" | "annulee" | "envoyee", msg: string, opts?: { payment_method?: string }) {
    setBusyId(id);
    startTransition(async () => {
      const res = await setInvoiceStatus(orgSlug, id, status, opts);
      setBusyId(null);
      if (res.ok) toast.success(msg);
      else toast.error(res.error ?? "Erreur");
    });
  }

  function doRelance(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await relanceInvoice(orgSlug, id);
      setBusyId(null);
      if (res.ok) toast.success("Relance envoyée par email ✓");
      else toast.error(res.error ?? "Échec de la relance");
    });
  }

  function doValidate(id: string, decision: "valide" | "refuse") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setInvoiceValidation(orgSlug, id, decision, validatorName);
      setBusyId(null);
      if (res.ok) toast.success(decision === "valide" ? "Facture validée ✓" : "Facture refusée");
      else toast.error(res.error ?? "Erreur");
    });
  }

  function confirmPay() {
    if (!payModal) return;
    changeStatus(payModal.id, "payee", "Facture payée ✓", { payment_method: payMethod || undefined });
    setPayModal(null);
    setPayMethod("");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Factures émises", value: String(kpis.count) },
          { label: "Total émis", value: formatEuros(kpis.totalEmitted) },
          { label: "✅ Encaissé", value: formatEuros(kpis.paid), color: "#2f8a4c" },
          { label: "⏳ À encaisser", value: formatEuros(kpis.unpaid), color: "#c2410c" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: k.color ?? "#2c2c2c" }}>
              {k.value}
            </div>
            <div className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Récap recettes par pôle */}
      {recapByPole.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-warmgray">
            <Tag className="size-3.5" /> Recettes encaissées par pôle
          </div>
          <div className="flex flex-wrap gap-3">
            {recapByPole.map(([pole, total]) => (
              <div key={pole} className="flex items-center gap-2 rounded-xl border border-border bg-cream px-3.5 py-2">
                <span className="text-[13px] font-semibold text-ink">{pole}</span>
                <span className="text-[13px] font-bold text-emerald-700">{formatEuros(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres statut */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const badge = f.key === "arelancer" ? toRelanceCount : f.key === "avalider" ? toValidateCount : 0;
          if ((f.key === "arelancer" || f.key === "avalider") && badge === 0 && filter !== f.key) return null;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                filter === f.key ? "border-coral bg-coral text-white"
                  : f.key === "arelancer" ? "border-red-200 bg-red-50 text-red-600 hover:border-red-300"
                  : f.key === "avalider" ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300"
                  : "border-border bg-white text-warmgray hover:border-coral/40"
              }`}
            >
              {f.label}
              {badge > 0 && <span className="rounded-full bg-white/30 px-1.5 text-[11px] font-bold">{badge}</span>}
            </button>
          );
        })}
        {poles.length > 0 && (
          <>
            <span className="mx-1 self-center text-warmgray/40">|</span>
            <button onClick={() => setPoleFilter("all")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                poleFilter === "all" ? "border-coral bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/40"
              }`}
            >Tous les pôles</button>
            {poles.map((p) => (
              <button key={p} onClick={() => setPoleFilter(p)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  poleFilter === p ? "border-coral bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/40"
                }`}
              >{p}</button>
            ))}
          </>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
          <FileText className="mx-auto mb-3 size-8 text-warmgray/50" />
          <p className="text-sm text-warmgray">Aucune facture dans cette catégorie.</p>
          <Link href={`/dashboard/${orgSlug}/factures/nouvelle`} className="mt-3 inline-block text-sm font-semibold text-coral-dark hover:underline">
            Créer une première facture →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.9fr_0.7fr_auto] gap-3 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Numéro</span><span>Client</span><span>Date</span><span>Montant TTC</span><span>Statut</span><span>Règlement</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((inv) => {
              const sm = STATUS_META[inv.status as InvoiceStatus];
              const isBusy = busyId === inv.id && pending;
              const isPaid = inv.status === "payee";
              const isUnpaid = inv.number && !isPaid && inv.status !== "annulee";
              return (
                <li key={inv.id} className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.9fr_0.7fr_auto] md:items-center md:gap-3">
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-ink">{inv.number ?? "— brouillon"}</div>
                    {inv.pole && <div className="mt-0.5 text-[11px] text-warmgray">{inv.pole}</div>}
                  </div>
                  <span className="truncate text-[13px] text-ink">{inv.client_name}</span>
                  <span className="text-[12px] text-warmgray">{fmtDate(inv.issue_date ?? inv.created_at)}</span>
                  <div>
                    <div className={`text-[13px] font-semibold ${isPaid ? "text-emerald-700" : isUnpaid ? "text-red-600" : "text-ink"}`}>
                      {formatEuros(inv.total_ttc)}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-warmgray">
                      {isPaid ? "✅ Payé" : isUnpaid ? "⏳ À payer" : ""}
                    </div>
                  </div>
                  <span className="flex flex-col items-start gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.cls}`}>{sm.label}</span>
                    {inv.validation_status === "a_valider" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">⏳ À valider</span>}
                    {inv.validation_status === "valide" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Validée</span>}
                    {inv.validation_status === "refuse" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">✗ Refusée</span>}
                    {isOverdue(inv) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">⚠ En retard</span>}
                  </span>
                  <span className="text-[12px] text-warmgray">
                    {inv.payment_method ? PM_LABEL[inv.payment_method] ?? inv.payment_method : "—"}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={`/dashboard/${orgSlug}/factures/${inv.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-coral/40">
                      <Eye className="size-3.5" /> Voir
                    </Link>
                    {inv.validation_status === "a_valider" && (
                      <>
                        <button disabled={isBusy} onClick={() => doValidate(inv.id, "valide")}
                          title="Valider (direction)"
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
                          <ShieldCheck className="size-3.5" />
                        </button>
                        <button disabled={isBusy} onClick={() => doValidate(inv.id, "refuse")}
                          title="Refuser (direction)"
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40">
                          <ShieldX className="size-3.5" />
                        </button>
                      </>
                    )}
                    {isOverdue(inv) && (
                      <button disabled={isBusy} onClick={() => doRelance(inv.id)}
                        title="Relancer par email"
                        className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40">
                        <BellRing className="size-3.5" />
                      </button>
                    )}
                    {inv.status === "emise" && (
                      <button disabled={isBusy} onClick={() => changeStatus(inv.id, "envoyee", "Marquée envoyée")}
                        title="Marquer envoyée"
                        className="inline-flex items-center rounded-lg border border-border p-1.5 text-indigo-600 hover:border-indigo-300 disabled:opacity-40">
                        <Send className="size-3.5" />
                      </button>
                    )}
                    {inv.number && !isPaid && inv.status !== "annulee" && (
                      <button disabled={isBusy} onClick={() => { setPayModal({ id: inv.id, name: inv.client_name }); setPayMethod(""); }}
                        title="Marquer payée"
                        className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
                        <Check className="size-3.5" />
                      </button>
                    )}
                    {inv.number && inv.status !== "annulee" && !isPaid && (
                      <button disabled={isBusy} onClick={() => changeStatus(inv.id, "annulee", "Facture annulée")}
                        title="Annuler"
                        className="inline-flex items-center rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600 disabled:opacity-40">
                        <Ban className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Modale : confirmation paiement + mode */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPayModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-heading text-lg font-bold text-ink">Marquer comme payée</h3>
            <p className="mb-4 text-[13px] text-warmgray">{payModal.name}</p>
            <label className="mb-1 block text-[12px] font-semibold text-ink">Mode de règlement</label>
            <select
              className="mb-5 w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm outline-none focus:border-coral"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="">— Non précisé —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPayModal(null)} className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-warmgray hover:border-coral/40">Annuler</button>
              <button onClick={confirmPay} className="rounded-full bg-emerald-600 px-5 py-2 text-[13px] font-bold text-white hover:bg-emerald-700">
                ✅ Confirmer le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
