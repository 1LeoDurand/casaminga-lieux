"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Check, Send, Ban, Eye } from "lucide-react";
import {
  type Invoice,
  type InvoiceStatus,
  STATUS_META,
  formatEuros,
} from "@/lib/invoicing/types";
import { setInvoiceStatus } from "@/app/(admin)/dashboard/[org]/factures/actions";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "brouillon", label: "Brouillons" },
  { key: "emise", label: "Émises" },
  { key: "envoyee", label: "Envoyées" },
  { key: "payee", label: "Payées" },
  { key: "en_retard", label: "En retard" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function InvoicesView({ invoices, orgSlug }: { invoices: Invoice[]; orgSlug: string }) {
  const [filter, setFilter] = useState("all");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const emitted = invoices.filter((i) => i.number);
    const totalEmitted = emitted.reduce((s, i) => s + i.total_ttc, 0);
    const paid = invoices.filter((i) => i.status === "payee").reduce((s, i) => s + i.total_ttc, 0);
    const unpaid = emitted
      .filter((i) => i.status !== "payee" && i.status !== "annulee")
      .reduce((s, i) => s + i.total_ttc, 0);
    return { count: emitted.length, totalEmitted, paid, unpaid };
  }, [invoices]);

  const filtered = useMemo(
    () => (filter === "all" ? invoices : invoices.filter((i) => i.status === filter)),
    [invoices, filter]
  );

  function changeStatus(id: string, status: "payee" | "annulee" | "envoyee", msg: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await setInvoiceStatus(orgSlug, id, status);
      setBusyId(null);
      if (res.ok) toast.success(msg);
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Factures émises", value: String(kpis.count) },
          { label: "Total émis", value: formatEuros(kpis.totalEmitted) },
          { label: "Encaissé", value: formatEuros(kpis.paid), color: "#2f8a4c" },
          { label: "En attente", value: formatEuros(kpis.unpaid), color: "#c2410c" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: k.color ?? "#2c2c2c" }}>
              {k.value}
            </div>
            <div className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === f.key
                ? "border-coral bg-coral text-white"
                : "border-border bg-white text-warmgray hover:border-coral/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
          <FileText className="mx-auto mb-3 size-8 text-warmgray/50" />
          <p className="text-sm text-warmgray">Aucune facture dans cette catégorie.</p>
          <Link
            href={`/dashboard/${orgSlug}/factures/nouvelle`}
            className="mt-3 inline-block text-sm font-semibold text-coral-dark hover:underline"
          >
            Créer une première facture →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1fr_1.4fr_0.9fr_0.9fr_0.8fr_auto] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Numéro</span><span>Client</span><span>Date</span><span>Montant TTC</span><span>Statut</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((inv) => {
              const sm = STATUS_META[inv.status as InvoiceStatus];
              const isBusy = busyId === inv.id && pending;
              return (
                <li
                  key={inv.id}
                  className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[1fr_1.4fr_0.9fr_0.9fr_0.8fr_auto] md:items-center md:gap-4"
                >
                  <span className="font-mono text-[13px] font-semibold text-ink">{inv.number ?? "— brouillon"}</span>
                  <span className="truncate text-[13.5px] text-ink">{inv.client_name}</span>
                  <span className="text-[12.5px] text-warmgray">{fmtDate(inv.issue_date ?? inv.created_at)}</span>
                  <span className="text-[13.5px] font-semibold text-ink">{formatEuros(inv.total_ttc)}</span>
                  <span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.cls}`}>{sm.label}</span>
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/dashboard/${orgSlug}/factures/${inv.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-coral/40"
                    >
                      <Eye className="size-3.5" /> Voir
                    </Link>
                    {inv.status === "emise" && (
                      <button
                        disabled={isBusy}
                        onClick={() => changeStatus(inv.id, "envoyee", "Marquée envoyée")}
                        title="Marquer envoyée"
                        className="inline-flex items-center rounded-lg border border-border p-1.5 text-indigo-600 hover:border-indigo-300 disabled:opacity-40"
                      >
                        <Send className="size-3.5" />
                      </button>
                    )}
                    {inv.number && inv.status !== "payee" && inv.status !== "annulee" && (
                      <button
                        disabled={isBusy}
                        onClick={() => changeStatus(inv.id, "payee", "Facture payée ✓")}
                        title="Marquer payée"
                        className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                      >
                        <Check className="size-3.5" />
                      </button>
                    )}
                    {inv.number && inv.status !== "annulee" && inv.status !== "payee" && (
                      <button
                        disabled={isBusy}
                        onClick={() => changeStatus(inv.id, "annulee", "Facture annulée")}
                        title="Annuler"
                        className="inline-flex items-center rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                      >
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
    </div>
  );
}
