"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus, X, Lock, ShieldCheck, ShieldAlert, Receipt, Ban, FileText,
  ChevronDown, AlertTriangle, Fingerprint, Calculator,
  CheckSquare, Square, Tag, BarChart2, TrendingUp, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  addCashEntryAction, voidCashEntryAction, closeCashRegisterAction, verifyCashChainAction,
} from "@/app/(admin)/dashboard/[org]/caisse/actions";
import { pointEntry, unpointEntry } from "@/lib/cash-pointing";
import {
  PAYMENT_METHODS, CASH_SOURCES, VAT_RATES, CLOSURE_TYPES,
  paymentLabel, sourceLabel, closureTypeLabel, fmtEuro, fmtDateTime, fmtDate, shortHash, splitVat,
} from "@/lib/cash-register-meta";
import type { CashEntry, CashClosure, CashClosureType, CashVerifyResult, CashPaymentMethod, CashSource, Pole } from "@/lib/types";

const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";
const selectCls = inputCls + " cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

// ── Formulaire encaissement ──────────────────────────────────
interface EntryForm {
  label: string; amount_ttc: string; vat_rate: string;
  payment_method: CashPaymentMethod; source: CashSource;
  operator: string; source_ref: string; receipt_email: string; pole_id: string;
}
const EMPTY: EntryForm = {
  label: "", amount_ttc: "", vat_rate: "0",
  payment_method: "especes", source: "adhesion", operator: "", source_ref: "", receipt_email: "", pole_id: "",
};

/** Raccourcis rapides — pré-remplissent le formulaire en 1 clic */
type Shortcut = Partial<Omit<EntryForm, "operator" | "receipt_email" | "pole_id" | "source_ref">>;
const QUICK_PRESETS: { label: string; emoji: string; values: Shortcut }[] = [
  { label: "Adhésion 20€",     emoji: "🤝", values: { label: "Adhésion",          amount_ttc: "20",  vat_rate: "0",  payment_method: "especes", source: "adhesion"    } },
  { label: "Adhésion 40€",     emoji: "🤝", values: { label: "Adhésion",          amount_ttc: "40",  vat_rate: "0",  payment_method: "especes", source: "adhesion"    } },
  { label: "Billet événement", emoji: "🎟", values: { label: "Billet événement",  amount_ttc: "",    vat_rate: "0",  payment_method: "cb",       source: "billetterie" } },
  { label: "Café 2€",          emoji: "☕", values: { label: "Café",              amount_ttc: "2",   vat_rate: "10", payment_method: "especes", source: "buvette"     } },
  { label: "Don libre",        emoji: "💛", values: { label: "Don libre",         amount_ttc: "",    vat_rate: "0",  payment_method: "especes", source: "don"         } },
  { label: "Boutique",         emoji: "🛍", values: { label: "Vente boutique",    amount_ttc: "",    vat_rate: "20", payment_method: "especes", source: "boutique"    } },
];

function EntryDrawer({ open, onClose, orgSlug, orgId, poles }: {
  open: boolean; onClose: () => void; orgSlug: string; orgId: string; poles: Pole[];
}) {
  const [form, setForm] = useState<EntryForm>(EMPTY);
  const [pending, start] = useTransition();
  const set = (k: keyof EntryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const ttc = parseFloat(form.amount_ttc) || 0;
  const rate = parseFloat(form.vat_rate) || 0;
  const { ht, vat } = splitVat(ttc, rate);

  function applyPreset(p: Shortcut) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || ttc <= 0 || !form.operator.trim()) {
      toast.error("Libellé, montant (> 0) et opérateur sont requis.");
      return;
    }
    start(async () => {
      const res = await addCashEntryAction(orgSlug, {
        organization_id: orgId,
        label: form.label.trim(),
        amount_ttc: ttc,
        vat_rate: rate,
        payment_method: form.payment_method,
        source: form.source,
        operator: form.operator.trim(),
        source_ref: form.source_ref.trim() || null,
        pole_id: form.pole_id || null,
      }, form.receipt_email.trim() ? { email: form.receipt_email.trim() } : undefined);
      if (res.ok) {
        toast.success(form.receipt_email.trim() ? "Encaissement scellé · reçu envoyé" : "Encaissement enregistré (écriture scellée)");
        setForm(EMPTY); onClose();
      }
      else toast.error(res.error ?? "Erreur");
    });
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Receipt className="size-4" /> Nouvel encaissement
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-6">
            {/* Raccourcis rapides */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Raccourcis</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.values)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-white"
                  >
                    <span>{p.emoji}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Libellé *">
              <input required value={form.label} onChange={set("label")} placeholder="ex : Adhésion 2026 — M. Durand" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant TTC (€) *">
                <input required type="number" min="0.01" step="0.01" value={form.amount_ttc} onChange={set("amount_ttc")} placeholder="0,00" className={inputCls} />
              </Field>
              <Field label="Taux de TVA">
                <select value={form.vat_rate} onChange={set("vat_rate")} className={selectCls}>
                  {VAT_RATES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {/* Aperçu ventilation */}
            {ttc > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><Calculator className="size-3.5" /> Ventilation</span>
                <span>HT <b className="text-slate-800">{fmtEuro(ht)}</b> · TVA <b className="text-slate-800">{fmtEuro(vat)}</b></span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Moyen de paiement">
                <select value={form.payment_method} onChange={set("payment_method")} className={selectCls}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Nature">
                <select value={form.source} onChange={set("source")} className={selectCls}>
                  {CASH_SOURCES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            {poles.length > 0 && (
              <Field label="Pôle / Activité">
                <select value={form.pole_id} onChange={set("pole_id")} className={selectCls}>
                  <option value="">— Aucun pôle —</option>
                  {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Référence (facultatif)">
              <input value={form.source_ref} onChange={set("source_ref")} placeholder="ex : n° facture, billet…" className={inputCls} />
            </Field>
            <Field label="Opérateur / caissier *">
              <input required value={form.operator} onChange={set("operator")} placeholder="Nom de la personne encaissant" className={inputCls} />
            </Field>
            <Field label="Email du reçu (facultatif)">
              <input type="email" value={form.receipt_email} onChange={set("receipt_email")} placeholder="Envoyer le reçu par email à…" className={inputCls} />
            </Field>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>Une fois validée, l'écriture est <b>scellée et inaltérable</b> (NF525). Toute erreur se corrige par une écriture d'annulation, jamais par suppression.</span>
            </div>
          </div>

          <div className="mt-auto border-t border-slate-100 px-6 py-4">
            <button type="submit" disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
              <Lock className="size-4" /> {pending ? "Scellement…" : "Valider et sceller l'écriture"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Vue principale ───────────────────────────────────────────
export function CashRegisterView({
  entries, closures, orgSlug, orgId, poles = [], pointedIds = [], postedClosureIds = [],
}: {
  entries: CashEntry[]; closures: CashClosure[]; orgSlug: string; orgId: string;
  poles?: Pole[]; pointedIds?: string[]; postedClosureIds?: string[];
}) {
  const postedSet = new Set(postedClosureIds);
  const [tab, setTab] = useState<"ecritures" | "pointage" | "clotures" | "statistiques">("ecritures");
  const [pointed, setPointed] = useState<Set<string>>(new Set(pointedIds));
  const [pointOperator, setPointOperator] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<CashEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidOperator, setVoidOperator] = useState("");
  const [closeType, setCloseType] = useState<CashClosureType | null>(null);
  const [closeOperator, setCloseOperator] = useState("");
  const [closeMenu, setCloseMenu] = useState(false);
  const [verify, setVerify] = useState<CashVerifyResult | null>(null);
  const [pending, start] = useTransition();

  // Seq déjà clôturées (jour) → repère visuel
  const lastDayClosure = closures.find((c) => c.closure_type === "jour");
  const closedUpTo = lastDayClosure?.last_entry_seq ?? 0;

  // KPI
  const lastClosure = closures[0];
  const perpetual = closures.reduce((max, c) => Math.max(max, c.perpetual_total_ttc), 0);
  const nonClotured = useMemo(
    () => entries.filter((e) => e.seq > closedUpTo).reduce((s, e) => s + Number(e.amount_ttc), 0),
    [entries, closedUpTo],
  );

  const poleById = useMemo(() => new Map(poles.map((p) => [p.id, p])), [poles]);
  const poleName = (id: string | null) => (id ? poleById.get(id)?.name ?? "Pôle inconnu" : "Sans pôle");

  // Écritures non clôturées (session de caisse en cours = depuis le dernier Z jour)
  const openEntries = useMemo(() => entries.filter((e) => e.seq > closedUpTo), [entries, closedUpTo]);

  // Récap Z par pôle (écritures non clôturées) + ventilation par moyen de paiement
  const recapByPole = useMemo(() => {
    const map = new Map<string, { total: number; byMethod: Map<string, number>; count: number }>();
    for (const e of openEntries) {
      const key = e.pole_id ?? "__none__";
      if (!map.has(key)) map.set(key, { total: 0, byMethod: new Map(), count: 0 });
      const slot = map.get(key)!;
      slot.total += Number(e.amount_ttc);
      slot.count += 1;
      slot.byMethod.set(e.payment_method, (slot.byMethod.get(e.payment_method) ?? 0) + Number(e.amount_ttc));
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [openEntries, poleById]);

  async function togglePoint(entry: CashEntry) {
    const isPointed = pointed.has(entry.id);
    // Optimiste
    setPointed((prev) => {
      const n = new Set(prev);
      if (isPointed) n.delete(entry.id); else n.add(entry.id);
      return n;
    });
    start(async () => {
      const res = isPointed
        ? await unpointEntry(orgSlug, orgId, entry.id)
        : await pointEntry(orgSlug, orgId, entry.id, pointOperator.trim() || "—");
      if (!res.ok) {
        // Rollback
        setPointed((prev) => {
          const n = new Set(prev);
          if (isPointed) n.add(entry.id); else n.delete(entry.id);
          return n;
        });
        toast.error(res.error ?? "Erreur de pointage");
      }
    });
  }

  async function runVerify() {
    start(async () => {
      const res = await verifyCashChainAction(orgId);
      setVerify(res);
      if (res?.ok) toast.success(`Chaîne intègre — ${res.entries_checked} écriture(s) vérifiée(s)`);
      else if (res) toast.error(`Anomalie détectée à l'écriture #${res.first_broken_seq}`);
      else toast.error("Vérification impossible");
    });
  }

  async function handleVoid() {
    if (!voidTarget || !voidReason.trim() || !voidOperator.trim()) {
      toast.error("Motif et opérateur requis.");
      return;
    }
    start(async () => {
      const res = await voidCashEntryAction(orgSlug, orgId, voidTarget, voidOperator.trim(), voidReason.trim());
      if (res.ok) { toast.success("Écriture d'annulation enregistrée"); setVoidTarget(null); setVoidReason(""); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  async function handleClose() {
    if (!closeType || !closeOperator.trim()) { toast.error("Opérateur requis."); return; }
    start(async () => {
      const res = await closeCashRegisterAction(orgSlug, orgId, closeType, closeOperator.trim());
      if (res.ok) { toast.success(`${closureTypeLabel(closeType)} effectuée`); setCloseType(null); setCloseOperator(""); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-amber-600"><Receipt className="size-4" /></div>
          <div className="text-xl font-bold text-slate-800">{fmtEuro(nonClotured)}</div>
          <div className="text-xs text-slate-500">À clôturer (depuis dernier Z)</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-slate-500"><FileText className="size-4" /></div>
          <div className="text-xl font-bold text-slate-800">{lastClosure ? fmtEuro(lastClosure.total_ttc) : "—"}</div>
          <div className="text-xs text-slate-500">{lastClosure ? `Dernière clôture (${lastClosure.period_label})` : "Aucune clôture"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-emerald-600"><Fingerprint className="size-4" /></div>
          <div className="text-xl font-bold text-slate-800">{fmtEuro(perpetual)}</div>
          <div className="text-xs text-slate-500">Grand total perpétuel</div>
        </div>
        <button onClick={runVerify} disabled={pending}
          className={`rounded-xl border p-4 text-left transition-colors ${
            verify ? (verify.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50") : "border-slate-200 bg-white hover:bg-slate-50"
          }`}>
          <div className={`mb-1 ${verify ? (verify.ok ? "text-emerald-600" : "text-red-600") : "text-slate-500"}`}>
            {verify ? (verify.ok ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />) : <ShieldCheck className="size-4" />}
          </div>
          <div className={`text-sm font-bold ${verify ? (verify.ok ? "text-emerald-700" : "text-red-700") : "text-slate-800"}`}>
            {pending ? "Vérification…" : verify ? (verify.ok ? "Chaîne intègre" : `Anomalie #${verify.first_broken_seq}`) : "Vérifier l'intégrité"}
          </div>
          <div className="text-xs text-slate-500">{verify ? `${verify.entries_checked} écriture(s)` : "Contrôle de la piste d'audit"}</div>
        </button>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["ecritures", "pointage", "clotures", "statistiques"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t === "ecritures" ? `Écritures (${entries.length})`
                : t === "pointage" ? "Pointage"
                : t === "clotures" ? `Clôtures (${closures.length})`
                : <span className="flex items-center gap-1.5"><BarChart2 className="size-3.5" />Statistiques</span>}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <button onClick={() => setCloseMenu((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Lock className="size-4" /> Clôturer <ChevronDown className="size-3.5" />
          </button>
          {closeMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCloseMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {CLOSURE_TYPES.map((c) => (
                  <button key={c.value} onClick={() => { setCloseType(c.value); setCloseMenu(false); }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50">
                    <span className="text-sm font-medium text-slate-800">{c.label}</span>
                    <span className="text-[11px] text-slate-400">{c.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          <Plus className="size-4" /> Encaissement
        </button>
      </div>

      {verify && !verify.ok && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Rupture de la chaîne d'intégrité détectée à l'écriture <b>#{verify.first_broken_seq}</b>. Les données ont pu être altérées hors application — contactez le support.</span>
        </div>
      )}

      {/* ── Écritures ── */}
      {tab === "ecritures" && (
        entries.length === 0 ? (
          <EmptyBox icon={<Receipt className="size-8 opacity-30" />} text="Aucun encaissement enregistré." action="Saisir le premier encaissement" onAction={() => setDrawerOpen(true)} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Libellé</th>
                  <th className="px-3 py-2 font-medium">Nature</th>
                  {poles.length > 0 && <th className="px-3 py-2 font-medium">Pôle</th>}
                  <th className="px-3 py-2 font-medium">Paiement</th>
                  <th className="px-3 py-2 text-right font-medium">TTC</th>
                  <th className="px-3 py-2 font-medium">Sceau</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const closed = e.seq <= closedUpTo;
                  return (
                    <tr key={e.id} className={`border-b border-slate-50 last:border-0 ${e.is_void ? "bg-red-50/40" : ""}`}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{e.ticket_ref}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{fmtDateTime(e.occurred_at)}</td>
                      <td className="px-3 py-2">
                        <span className={e.is_void ? "text-red-700" : "text-slate-800"}>{e.label}</span>
                        {e.is_void && <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Annulation</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{sourceLabel(e.source)}</td>
                      {poles.length > 0 && (
                        <td className="px-3 py-2 text-xs">
                          {e.pole_id ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ background: `${poleById.get(e.pole_id)?.color ?? "#888"}22`, color: poleById.get(e.pole_id)?.color ?? "#555" }}>
                              {poleName(e.pole_id)}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-500">{paymentLabel(e.payment_method)}</td>
                      <td className={`px-3 py-2 text-right font-medium tabular-nums ${e.amount_ttc < 0 ? "text-red-600" : "text-slate-800"}`}>{fmtEuro(e.amount_ttc)}</td>
                      <td className="px-3 py-2">
                        <span title={e.entry_hash} className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                          <Lock className="size-3" /> {shortHash(e.entry_hash)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!e.is_void && !closed && (
                          <button onClick={() => { setVoidTarget(e); setVoidOperator(""); setVoidReason(""); }}
                            title="Annuler par écriture de correction"
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600">
                            <Ban className="size-4" />
                          </button>
                        )}
                        {closed && <Lock className="ml-auto size-3.5 text-slate-300" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Pointage ── */}
      {tab === "pointage" && (
        openEntries.length === 0 ? (
          <EmptyBox icon={<CheckSquare className="size-8 opacity-30" />} text="Aucune opération à pointer (tout est clôturé)." />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Récap Z par pôle */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Tag className="size-3.5" /> Récap encaissements par pôle (depuis le dernier Z)
              </div>
              <div className="flex flex-col gap-2">
                {recapByPole.map(([key, slot]) => {
                  const pole = key === "__none__" ? null : poleById.get(key);
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        {pole && <span className="size-2.5 rounded-full" style={{ background: pole.color }} />}
                        {key === "__none__" ? "Sans pôle" : pole?.name ?? "Pôle inconnu"}
                      </span>
                      <span className="text-xs text-slate-400">{slot.count} op.</span>
                      <span className="ml-auto flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        {Array.from(slot.byMethod.entries()).map(([m, v]) => (
                          <span key={m}>{paymentLabel(m as CashPaymentMethod)} <b className="text-slate-700">{fmtEuro(v)}</b></span>
                        ))}
                      </span>
                      <span className="text-base font-bold text-slate-900">{fmtEuro(slot.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pointage opération par opération */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-slate-700">
                  Pointage — {openEntries.filter((e) => pointed.has(e.id)).length}/{openEntries.length} opérations pointées
                </span>
                <input
                  value={pointOperator} onChange={(e) => setPointOperator(e.target.value)}
                  placeholder="Votre nom (pointeur)" className={inputCls + " ml-auto h-8 py-1"}
                />
              </div>
              <ul className="divide-y divide-slate-50">
                {openEntries.map((e) => {
                  const isPointed = pointed.has(e.id);
                  return (
                    <li key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${isPointed ? "bg-emerald-50/40" : ""}`}>
                      <button onClick={() => togglePoint(e)} disabled={pending}
                        className={isPointed ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"}
                        title={isPointed ? "Dé-pointer" : "Pointer cette opération"}>
                        {isPointed ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                      </button>
                      <span className="font-mono text-[11px] text-slate-400">{e.ticket_ref}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-800">{e.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {fmtDateTime(e.occurred_at)} · {poleName(e.pole_id)} · {paymentLabel(e.payment_method)}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${e.amount_ttc < 0 ? "text-red-600" : "text-slate-800"}`}>
                        {fmtEuro(e.amount_ttc)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )
      )}

      {/* ── Clôtures ── */}
      {tab === "clotures" && (
        closures.length === 0 ? (
          <EmptyBox icon={<FileText className="size-8 opacity-30" />} text="Aucune clôture effectuée." />
        ) : (
          <div className="flex flex-col gap-3">
            {closures.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">{closureTypeLabel(c.closure_type)}</span>
                  <span className="font-semibold text-slate-800">{c.period_label}</span>
                  <span className="text-xs text-slate-400">#{c.seq}</span>
                  {c.closure_type === "jour" && postedSet.has(c.id) && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3" /> Versé en trésorerie
                    </span>
                  )}
                  <span className="ml-auto text-lg font-bold text-slate-900">{fmtEuro(c.total_ttc)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span>{c.entry_count} écriture(s) (#{c.first_entry_seq}→#{c.last_entry_seq})</span>
                  <span>HT {fmtEuro(c.total_ht)} · TVA {fmtEuro(c.total_vat)}</span>
                  <span>Cumul perpétuel <b className="text-slate-700">{fmtEuro(c.perpetual_total_ttc)}</b></span>
                  <span>Clôturé le {fmtDate(c.closed_at)} par {c.operator}</span>
                </div>
                {/* Ventilation TVA */}
                {Array.isArray(c.vat_breakdown) && c.vat_breakdown.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.vat_breakdown.map((v, i) => (
                      <span key={i} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        TVA {Number(v.rate)} % — HT {fmtEuro(v.ht)} / TVA {fmtEuro(v.vat)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1 font-mono text-[10px] text-slate-400" title={c.closure_hash}>
                  <Fingerprint className="size-3" /> sceau {shortHash(c.closure_hash)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Statistiques ── */}
      {tab === "statistiques" && (
        <StatsView entries={entries} poles={poles} />
      )}

      <EntryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} orgSlug={orgSlug} orgId={orgId} poles={poles} />

      {/* Dialog annulation */}
      {voidTarget && (
        <ConfirmDialog
          open
          title={`Annuler l'écriture ${voidTarget.ticket_ref}`}
          message={
            <>
              Conformément à la loi, l'écriture d'origine est conservée. Une écriture de correction (montant inverse) sera ajoutée à la chaîne.
              <span className="mt-3 flex flex-col gap-2">
                <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Motif de l'annulation *" className={inputCls} />
                <input value={voidOperator} onChange={(e) => setVoidOperator(e.target.value)} placeholder="Opérateur *" className={inputCls} />
              </span>
            </>
          }
          tone="danger" busy={pending}
          confirmLabel="Enregistrer l'annulation"
          onConfirm={handleVoid}
          onCancel={() => setVoidTarget(null)}
        />
      )}

      {/* Dialog clôture */}
      {closeType && (
        <ConfirmDialog
          open
          title={closureTypeLabel(closeType)}
          message={
            <>
              Cette clôture scelle définitivement toutes les écritures depuis le dernier arrêté de même type et fige les totaux. Action irréversible.
              <span className="mt-3 flex flex-col gap-2">
                <span className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Montant à clôturer</span>
                  <b className="text-slate-800">{fmtEuro(nonClotured)}</b>
                </span>
                <input value={closeOperator} onChange={(e) => setCloseOperator(e.target.value)} placeholder="Opérateur responsable *" className={inputCls} />
              </span>
            </>
          }
          tone="default" busy={pending}
          confirmLabel="Confirmer la clôture"
          onConfirm={handleClose}
          onCancel={() => setCloseType(null)}
        />
      )}
    </div>
  );
}

// ── Statistiques ─────────────────────────────────────────────
function StatsView({ entries, poles }: { entries: CashEntry[]; poles: Pole[] }) {
  const poleById = new Map(poles.map((p) => [p.id, p]));
  const real = entries.filter((e) => !e.is_void);

  // ── CA par jour (30 derniers jours) ──
  const today = new Date();
  const days: { label: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    const total = real
      .filter((e) => e.occurred_at.slice(0, 10) === key)
      .reduce((s, e) => s + Number(e.amount_ttc), 0);
    days.push({ label, total });
  }
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  // ── Répartition par source ──
  const bySource = new Map<string, number>();
  for (const e of real) {
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + Number(e.amount_ttc));
  }
  const sourceEntries = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]);
  const totalSource = sourceEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // ── Répartition par moyen de paiement ──
  const byMethod = new Map<string, number>();
  for (const e of real) {
    byMethod.set(e.payment_method, (byMethod.get(e.payment_method) ?? 0) + Number(e.amount_ttc));
  }
  const methodEntries = Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]);
  const totalMethod = methodEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // ── Répartition par pôle ──
  const byPole = new Map<string, number>();
  for (const e of real) {
    const key = e.pole_id ?? "__none__";
    byPole.set(key, (byPole.get(key) ?? 0) + Number(e.amount_ttc));
  }
  const poleEntries = Array.from(byPole.entries()).sort((a, b) => b[1] - a[1]);
  const totalPole = poleEntries.reduce((s, [, v]) => s + v, 0) || 1;

  const totalAll = real.reduce((s, e) => s + Number(e.amount_ttc), 0);

  if (real.length === 0) {
    return <EmptyBox icon={<BarChart2 className="size-8 opacity-30" />} text="Aucune écriture pour calculer les statistiques." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPI résumé */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total encaissé</div>
          <div className="text-2xl font-bold text-slate-800">{fmtEuro(totalAll)}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{real.length} écriture{real.length > 1 ? "s" : ""}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mois en cours</div>
          <div className="text-2xl font-bold text-slate-800">
            {fmtEuro(real.filter((e) => e.occurred_at.slice(0, 7) === today.toISOString().slice(0, 7)).reduce((s, e) => s + Number(e.amount_ttc), 0))}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">{today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Panier moyen</div>
          <div className="text-2xl font-bold text-slate-800">{fmtEuro(real.length ? totalAll / real.length : 0)}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">par écriture</div>
        </div>
      </div>

      {/* CA sur 30 jours */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          <TrendingUp className="size-3.5" /> CA quotidien — 30 derniers jours
        </div>
        <div className="flex h-36 items-end gap-0.5">
          {days.map((d) => (
            <div key={d.label} className="group relative flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-sm bg-slate-200 transition-colors group-hover:bg-slate-400"
                style={{ height: `${Math.max(d.total > 0 ? 4 : 0, (d.total / maxDay) * 100)}%` }}
                title={`${d.label} — ${fmtEuro(d.total)}`}
              />
              {/* Tooltip */}
              {d.total > 0 && (
                <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {fmtEuro(d.total)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{days[0]?.label}</span>
          <span>{days[14]?.label}</span>
          <span>{days[29]?.label}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Par source */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Par nature</div>
          <div className="flex flex-col gap-2">
            {sourceEntries.map(([src, val]) => (
              <div key={src}>
                <div className="mb-0.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-slate-700">{sourceLabel(src)}</span>
                  <span className="text-slate-500">{fmtEuro(val)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${(val / totalSource) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Par moyen de paiement */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Par paiement</div>
          <div className="flex flex-col gap-2">
            {methodEntries.map(([method, val]) => (
              <div key={method}>
                <div className="mb-0.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-slate-700">{paymentLabel(method)}</span>
                  <span className="text-slate-500">{fmtEuro(val)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(val / totalMethod) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Par pôle */}
        {poles.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Par pôle</div>
            <div className="flex flex-col gap-2">
              {poleEntries.map(([key, val]) => {
                const pole = key === "__none__" ? null : poleById.get(key);
                const color = pole?.color ?? "#94a3b8";
                return (
                  <div key={key}>
                    <div className="mb-0.5 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        {pole && <span className="size-2 rounded-full" style={{ background: color }} />}
                        {key === "__none__" ? "Sans pôle" : pole?.name ?? "Inconnu"}
                      </span>
                      <span className="text-slate-500">{fmtEuro(val)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(val / totalPole) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyBox({ icon, text, action, onAction }: { icon: React.ReactNode; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="text-sm">{text}</p>
      {action && onAction && (
        <button onClick={onAction} className="mt-3 text-sm text-slate-600 underline underline-offset-2">{action}</button>
      )}
    </div>
  );
}
