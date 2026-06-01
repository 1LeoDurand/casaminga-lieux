"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Search, RotateCcw, Plus, TrendingUp, TrendingDown, Pencil, Trash2, Euro, Download } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { TransactionForm, type TransactionFormValues } from "@/components/mc/transaction-form";
import {
  TRANSACTION_STATUSES, categoryLabel, txStatusLabel, txStatusBadge,
  formatAmount, formatDate, buildMonthSummaries,
} from "@/lib/finances-meta";
import { createTransactionAction, deleteTransactionAction, updateTransactionAction } from "@/app/(admin)/dashboard/[org]/finances/actions";
import type { Person, Transaction } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
function StatBadge({ s }: { s: string }) { return <span className={`mc-badge ${txStatusBadge(s)}`}>{txStatusLabel(s)}</span>; }

/** Graphique barres CSS simple — pas de lib externe. */
function BarChart({ data }: { data: { label: string; recettes: number; depenses: number }[] }) {
  const max = Math.max(...data.flatMap((d) => [d.recettes, d.depenses]), 1);
  return (
    <div className="flex items-end gap-3 overflow-x-auto py-2">
      {data.map((d) => (
        <div key={d.label} className="flex shrink-0 flex-col items-center gap-1.5" style={{ minWidth: 48 }}>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            <div title={`Recettes : ${formatAmount(d.recettes)}`}
              style={{ width: 14, height: `${Math.round((d.recettes / max) * 80)}px`, background: "#2f8a4c", borderRadius: "3px 3px 0 0", minHeight: d.recettes > 0 ? 2 : 0 }} />
            <div title={`Dépenses : ${formatAmount(d.depenses)}`}
              style={{ width: 14, height: `${Math.round((d.depenses / max) * 80)}px`, background: "var(--coral-dark)", borderRadius: "3px 3px 0 0", minHeight: d.depenses > 0 ? 2 : 0 }} />
          </div>
          <span className="text-[10px] text-warmgray">{d.label}</span>
        </div>
      ))}
      <div className="ml-4 flex shrink-0 flex-col gap-1.5 self-end pb-4 text-[11px] text-warmgray">
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[#2f8a4c]" /> Recettes</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-coral-dark" /> Dépenses</span>
      </div>
    </div>
  );
}

// UX-017 — Export CSV côté client, sans back-end
function exportCsv(transactions: Transaction[], orgSlug: string, catLabel: (c: string) => string, statLabel: (s: string) => string) {
  const BOM = "﻿"; // BOM UTF-8 pour Excel
  const headers = ["Date", "Libellé", "Type", "Catégorie", "Statut", "Montant (€)"].join(";");
  const rows = transactions.map((t) =>
    [
      t.date ?? "",
      `"${(t.label ?? "").replace(/"/g, '""')}"`,
      t.type === "recette" ? "Recette" : "Dépense",
      catLabel(t.category),
      statLabel(t.status),
      (t.type === "recette" ? "" : "-") + Number(t.amount).toFixed(2),
    ].join(";")
  );
  const csv = BOM + [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${orgSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FinancesView({ transactions, persons, orgSlug, orgId }: {
  transactions: Transaction[]; persons: Person[]; orgSlug: string; orgId: string;
}) {
  const [typeF, setTypeF] = useState<"all" | "recette" | "depense">("all");
  const [statF, setStatF] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const personName = (id: string | null) => id ? personById.get(id)?.name ?? null : null;
  const selected = transactions.find((t) => t.id === selectedId) ?? null;

  const kpis = useMemo(() => {
    const valid = transactions.filter((t) => t.status !== "annulee");
    const recettes = valid.filter((t) => t.type === "recette").reduce((s, t) => s + Number(t.amount), 0);
    const depenses = valid.filter((t) => t.type === "depense").reduce((s, t) => s + Number(t.amount), 0);
    return {
      recettes, depenses, solde: recettes - depenses,
      enAttente: transactions.filter((t) => t.status === "en_attente").length,
      total: transactions.length,
    };
  }, [transactions]);

  const monthData = useMemo(() => buildMonthSummaries(transactions), [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeF !== "all" && t.type !== typeF) return false;
      if (statF.size && !statF.has(t.status)) return false;
      if (q) {
        const hay = [t.label, t.notes, categoryLabel(t.category), personName(t.person_id)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, typeF, statF, search, personById]);

  const hasFilters = search.trim() !== "" || typeF !== "all" || statF.size > 0;

  function submitForm(values: TransactionFormValues) {
    const n = Number(values.amount.replace(",", "."));
    const payload = {
      type: values.type, category: values.category, label: values.label,
      amount: n, date: values.date, status: values.status,
      person_id: values.personId || null, notes: values.notes.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateTransactionAction(orgSlug, editing.id, payload)
        : await createTransactionAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Transaction mise à jour" : "Transaction ajoutée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function doDelete(t: Transaction) {
    startTransition(async () => {
      const { ok } = await deleteTransactionAction(orgSlug, t.id);
      if (ok) { toast.success("Transaction supprimée"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (transactions.length === 0) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Euro className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucune transaction pour le moment</div>
        <p className="mc-empty-sub">Enregistrez recettes et dépenses pour suivre la santé financière du lieu.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle transaction</button>
        <p className="mt-2 text-[11px] text-warmgray/60 max-w-xs">💡 Connectez HelloAsso dans Paramètres pour importer automatiquement vos paiements d'adhésion</p>
      </div></div>
      <TransactionForm key="create-open" open={formOpen} transaction={null} persons={persons} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{formatAmount(kpis.recettes)}</div>
          <div className="mc-stat-lbl">Recettes</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>{formatAmount(kpis.depenses)}</div>
          <div className="mc-stat-lbl">Dépenses</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: kpis.solde >= 0 ? "#2f8a4c" : "var(--coral-dark)" }}>{formatAmount(kpis.solde)}</div>
          <div className="mc-stat-lbl">Solde net</div>
        </div>
        {/* UX-018 — KPI "En attente" cliquable → filtre la liste */}
        <button
          type="button"
          className="mc-stat cursor-pointer text-left hover:border-coral"
          title="Cliquer pour filtrer les transactions en attente"
          onClick={() => setStatF(new Set(["en_attente"]))}
        >
          <div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.enAttente}</div>
          <div className="mc-stat-lbl">En attente ↗</div>
        </button>
        <div className="mc-stat">
          <div className="mc-stat-val">{kpis.total}</div>
          <div className="mc-stat-lbl">Transactions</div>
        </div>
      </div>

      {/* UX-022 — lien de synthèse vers Adhésions pour le trésorier */}
      <div className="rounded-xl border border-border/60 bg-white px-4 py-3 text-[13px] text-warmgray flex items-center justify-between gap-3">
        <span>Les cotisations perçues via les campagnes d&apos;adhésion ne sont pas encore remontées ici automatiquement.</span>
        <a href={`/dashboard/${orgSlug}/adhesions`} className="shrink-0 font-semibold text-coral-dark hover:underline">Voir les adhésions →</a>
      </div>

      {/* Graphique mensuel — UX-020: libellé de période */}
      {monthData.length > 0 ? (
        <div className="mc-card px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">Recettes vs Dépenses par mois</h3>
            <span className="text-[11px] text-warmgray">
              {monthData.length === 1
                ? monthData[0].label
                : `${monthData[0].label} – ${monthData[monthData.length - 1].label}`}
              {" "}· {monthData.length} mois
            </span>
          </div>
          <BarChart data={monthData} />
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search"><span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle</button>
          {/* UX-019 — "Réinitialiser" → "Effacer les filtres" pour lever l'ambiguïté */}
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setSearch(""); setTypeF("all"); setStatF(new Set()); }} disabled={!hasFilters}><RotateCcw className="size-3.5" /> Effacer les filtres</button>
          {/* UX-017 — Export CSV côté client */}
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => exportCsv(filtered, orgSlug, categoryLabel, txStatusLabel)} title="Exporter en CSV (Excel)"><Download className="size-3.5" /> Exporter</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">
            {(["all", "recette", "depense"] as const).map((t) => (
              <button key={t} type="button" className={`mc-chip ${typeF === t ? "active" : ""}`} onClick={() => setTypeF(t)}>
                {t === "all" ? "Tous" : t === "recette" ? "Recettes" : "Dépenses"}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">{TRANSACTION_STATUSES.map((s) => (
            <button key={s.value} type="button" className={`mc-chip ${statF.has(s.value) ? "active" : ""}`} onClick={() => setStatF((set) => toggle(set, s.value))}>{s.label}</button>
          ))}</div>
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><Search className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucun résultat</div>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={() => { setSearch(""); setTypeF("all"); setStatF(new Set()); }}><RotateCcw className="size-3.5" /> Effacer les filtres</button>
        </div></div>
      ) : (
        <div className="mc-card overflow-hidden">
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>Libellé</th><th>Type</th><th>Statut</th><th>Date</th><th className="text-right">Montant</th></tr></thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} onClick={() => setSelectedId(t.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        {t.type === "recette"
                          ? <TrendingUp className="size-4 shrink-0 text-[#2f8a4c]" />
                          : <TrendingDown className="size-4 shrink-0 text-coral-dark" />}
                        <span className="font-semibold text-foreground">{t.label}</span>
                      </div>
                      <span className="mt-0.5 block pl-6 text-[11px] text-warmgray">{categoryLabel(t.category)}</span>
                    </td>
                    <td><span className={`mc-badge ${t.type === "recette" ? "mc-badge-green" : "mc-badge-red"}`}>{t.type === "recette" ? "Recette" : "Dépense"}</span></td>
                    <td><StatBadge s={t.status} /></td>
                    <td className="text-[12px] text-warmgray">{formatDate(t.date)}</td>
                    <td className={`text-right font-bold ${t.type === "recette" ? "text-[#2f8a4c]" : "text-coral-dark"}`}>
                      {t.type === "recette" ? "+" : "−"}{formatAmount(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Détail transaction">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.label}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`mc-badge ${selected.type === "recette" ? "mc-badge-green" : "mc-badge-red"}`}>{selected.type === "recette" ? "Recette" : "Dépense"}</span>
                  <StatBadge s={selected.status} />
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className={`rounded-xl p-5 text-center ${selected.type === "recette" ? "bg-[#e8f5ee]" : "bg-[#fdeae4]"}`}>
                <div className={`font-heading text-3xl font-bold ${selected.type === "recette" ? "text-[#2f8a4c]" : "text-coral-dark"}`}>
                  {selected.type === "recette" ? "+" : "−"}{formatAmount(Number(selected.amount))}
                </div>
                <div className="mt-1 text-sm text-warmgray">{formatDate(selected.date)} · {categoryLabel(selected.category)}</div>
              </div>
              <dl className="grid grid-cols-1 gap-2.5 rounded-xl bg-white p-4 text-sm">
                {personName(selected.person_id) ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Personne</dt><dd className="mt-0.5 font-medium">{personName(selected.person_id)}</dd></div> : null}
              </dl>
              {selected.notes ? (
                <div><h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.notes}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <TransactionForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} transaction={editing} persons={persons} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette transaction ?"
        message={confirmDelete ? `« ${confirmDelete.label} » sera définitivement supprimée.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
