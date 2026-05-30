"use client";

import { useMemo, useState, useTransition } from "react";
import {
  X,
  Search,
  RotateCcw,
  Download,
  Inbox,
  Mail,
  Phone,
  Building2,
  Check,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/mc/status-badge";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { setRequestStatus } from "@/app/(admin)/dashboard/[org]/demandes/actions";
import {
  ALL_STATUSES,
  OPEN_STATUSES,
  PRIORITIES,
  REQUEST_TYPES,
  SELECTABLE_STATUSES,
  priorityMeta,
  requestTypeLabel,
} from "@/lib/requests-meta";
import type { IncomingRequest, RequestStatus } from "@/lib/types";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta(priority);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= 7 * 24 * 3600 * 1000;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function RequestsView({
  requests,
  orgSlug,
}: {
  requests: IncomingRequest[];
  orgSlug: string;
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [prioF, setPrioF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  // ── KPIs (toujours calculés sur l'ensemble, pas sur le filtre) ──
  const kpis = useMemo(() => {
    const open = requests.filter((r) => OPEN_STATUSES.includes(r.status));
    return {
      open: open.length,
      urgent: open.filter((r) => r.priority === "haute").length,
      week: requests.filter((r) => isThisWeek(r.received_at)).length,
      waiting: requests.filter((r) => r.status === "attente").length,
      done: requests.filter((r) => r.status === "validee").length,
    };
  }, [requests]);

  // ── Liste filtrée ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (typeF.size && !typeF.has(r.type ?? "")) return false;
      if (statusF.size && !statusF.has(r.status)) return false;
      if (prioF.size && !prioF.has(r.priority)) return false;
      if (q) {
        const hay = [r.name, r.email, r.organization_ext, r.summary, r.message]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, typeF, statusF, prioF]);

  const hasFilters =
    search.trim() !== "" || typeF.size > 0 || statusF.size > 0 || prioF.size > 0;

  function resetFilters() {
    setSearch("");
    setTypeF(new Set());
    setStatusF(new Set());
    setPrioF(new Set());
  }

  function apply(id: string, status: RequestStatus, successLabel: string) {
    startTransition(async () => {
      const { ok } = await setRequestStatus(orgSlug, id, status);
      if (ok) toast.success(successLabel);
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function exportCsv() {
    const rows = filtered.length ? filtered : requests;
    if (!rows.length) {
      toast.info("Aucune demande à exporter.");
      return;
    }
    const head = ["Nom", "Email", "Téléphone", "Structure", "Type", "Statut", "Priorité", "Reçue le"];
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        esc(r.name),
        esc(r.email),
        esc(r.phone),
        esc(r.organization_ext),
        esc(requestTypeLabel(r.type)),
        esc(r.status),
        esc(r.priority),
        esc(formatDate(r.received_at)),
      ].join(",")
    );
    const csv = [head.join(","), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demandes-${orgSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} demande(s) exportée(s)`);
  }

  // ── État vide global (aucune demande) ──
  if (requests.length === 0) {
    return (
      <div className="mc-card">
        <div className="mc-empty">
          <span className="mc-empty-ic">
            <Inbox className="size-6" strokeWidth={1.8} />
          </span>
          <div className="mc-empty-title">Aucune demande pour le moment</div>
          <p className="mc-empty-sub">
            Les messages envoyés depuis le site public apparaîtront ici, prêts à
            être qualifiés et traités.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat">
          <div className="mc-stat-val">{kpis.open}</div>
          <div className="mc-stat-lbl">Demandes ouvertes</div>
          <div className="mc-stat-chg">à traiter</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>
            {kpis.urgent}
          </div>
          <div className="mc-stat-lbl">Urgentes</div>
          <div className="mc-stat-chg warn">priorité haute</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val">{kpis.week}</div>
          <div className="mc-stat-lbl">Cette semaine</div>
          <div className="mc-stat-chg up">7 derniers jours</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>
            {kpis.waiting}
          </div>
          <div className="mc-stat-lbl">En attente</div>
          <div className="mc-stat-chg warn">réponse attendue</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#2f8a4c" }}>
            {kpis.done}
          </div>
          <div className="mc-stat-lbl">Traitées</div>
          <div className="mc-stat-chg up">validées</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search">
            <span className="mc-search-ic">
              <Search className="size-4" />
            </span>
            <input
              className="mc-input"
              placeholder="Rechercher par nom, email, structure…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={exportCsv}>
            <Download className="size-3.5" /> Exporter CSV
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-outline mc-btn-sm"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            <RotateCcw className="size-3.5" /> Réinitialiser
          </button>
        </div>

        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">
            {REQUEST_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`}
                onClick={() => setTypeF((s) => toggle(s, t.value))}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">
            {ALL_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`mc-chip ${statusF.has(s.value) ? "active" : ""}`}
                onClick={() => setStatusF((set) => toggle(set, s.value))}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Priorité</span>
          <div className="mc-chips">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`mc-chip ${prioF.has(p.value) ? "active" : ""}`}
                onClick={() => setPrioF((set) => toggle(set, p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="text-[13px] font-semibold text-foreground">
            {filtered.length} demande{filtered.length > 1 ? "s" : ""}
            {hasFilters ? ` / ${requests.length}` : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Search className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun résultat</div>
            <p className="mc-empty-sub">
              Aucune demande ne correspond à ces filtres.
            </p>
            <button
              type="button"
              className="mc-btn mc-btn-outline mc-btn-sm mt-1"
              onClick={resetFilters}
            >
              <RotateCcw className="size-3.5" /> Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Demandeur</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Priorité</th>
                  <th>Reçue le</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)}>
                    <td>
                      <div className="font-semibold text-foreground">{r.name}</div>
                      <div className="truncate text-[12px] text-warmgray">{r.email}</div>
                    </td>
                    <td>
                      <span className="mc-badge mc-badge-lime">
                        {requestTypeLabel(r.type)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-warmgray">
                      {formatDate(r.received_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer détail */}
      {selected ? (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="mc-drawer-ov"
            onClick={() => setSelectedId(null)}
          />
          <aside className="mc-drawer" aria-label="Fiche demande">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
                <h2 className="mt-2 font-heading text-xl font-bold text-foreground">
                  {selected.name}
                </h2>
                <p className="text-sm text-warmgray">
                  {requestTypeLabel(selected.type)} · {formatDate(selected.received_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-6">
              <dl className="grid gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-warmgray" />
                  <dd className="truncate font-medium">{selected.email ?? "—"}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-warmgray" />
                  <dd className="font-medium">{selected.phone ?? "—"}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="size-4 shrink-0 text-warmgray" />
                  <dd className="truncate font-medium">{selected.organization_ext ?? "—"}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">
                  Message
                </h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-foreground">
                  {selected.message ?? "—"}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">
                  Changer le statut
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SELECTABLE_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={pending || selected.status === s.value}
                      onClick={() => apply(selected.id, s.value, `Statut : ${s.label}`)}
                      className="mc-chip disabled:opacity-40"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button
                type="button"
                disabled={pending}
                onClick={() => apply(selected.id, "validee", "Demande marquée comme traitée")}
                className="mc-btn mc-btn-lime flex-1"
              >
                <Check className="size-4" /> Marquer traitée
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmArchive(selected.id)}
                className="mc-btn mc-btn-outline"
              >
                <Archive className="size-4" /> Archiver
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Confirmation d'archivage */}
      <ConfirmDialog
        open={confirmArchive !== null}
        title="Archiver cette demande ?"
        message="La demande quittera la liste active. Vous pourrez la retrouver via le filtre « Archivée »."
        confirmLabel="Archiver"
        tone="danger"
        busy={pending}
        onCancel={() => setConfirmArchive(null)}
        onConfirm={() => {
          const id = confirmArchive;
          setConfirmArchive(null);
          if (id) {
            apply(id, "archivee", "Demande archivée");
            setSelectedId(null);
          }
        }}
      />
    </div>
  );
}
