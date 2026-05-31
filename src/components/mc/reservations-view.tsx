"use client";

import { useMemo, useState, useTransition } from "react";
import {
  X,
  Search,
  RotateCcw,
  Plus,
  LayoutGrid,
  CalendarDays,
  List,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Ban,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  ReservationForm,
  type ReservationFormValues,
} from "@/components/mc/reservation-form";
import { typeBadge, typeLabel } from "@/lib/spaces-meta";
import {
  RESERVATION_STATUSES,
  KANBAN_ORDER,
  reservationStatusBadge,
  reservationStatusLabel,
  formatRange,
  formatDayLong,
  durationLabel,
  formatPrice,
  dayKey,
  isToday,
} from "@/lib/reservations-meta";
import {
  createReservationAction,
  deleteReservationAction,
  updateReservationAction,
} from "@/app/(admin)/dashboard/[org]/reservations/actions";
import type { Person, Reservation, ReservationStatus, Space } from "@/lib/types";

type View = "kanban" | "agenda" | "table";

const COLUMN_DOT: Record<ReservationStatus, string> = {
  demandee: "#d98a1f",
  confirmee: "#2f8a4c",
  terminee: "#8a8a8a",
  annulee: "#c2452f",
};

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`mc-badge ${reservationStatusBadge(status)}`}>
      {reservationStatusLabel(status)}
    </span>
  );
}

export function ReservationsView({
  reservations,
  spaces,
  persons,
  orgSlug,
  orgId,
}: {
  reservations: Reservation[];
  spaces: Space[];
  persons: Person[];
  orgSlug: string;
  orgId: string;
}) {
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [spaceF, setSpaceF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Reservation | null>(null);
  const [pending, startTransition] = useTransition();

  const spaceById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s])),
    [spaces]
  );
  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  const spaceName = (id: string) => spaceById.get(id)?.name ?? "Espace supprimé";
  const personName = (id: string | null) =>
    id ? personById.get(id)?.name ?? null : null;

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  const kpis = useMemo(() => {
    return {
      total: reservations.length,
      today: reservations.filter(
        (r) => r.status !== "annulee" && isToday(r.start_at)
      ).length,
      demandees: reservations.filter((r) => r.status === "demandee").length,
      confirmees: reservations.filter((r) => r.status === "confirmee").length,
      annulees: reservations.filter((r) => r.status === "annulee").length,
    };
  }, [reservations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (spaceF.size && !spaceF.has(r.space_id)) return false;
      if (statusF.size && !statusF.has(r.status)) return false;
      if (q) {
        const hay = [
          r.title,
          spaceName(r.space_id),
          personName(r.person_id),
          r.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, search, spaceF, statusF, spaceById, personById]);

  const byStatus = useMemo(() => {
    const map: Record<ReservationStatus, Reservation[]> = {
      demandee: [],
      confirmee: [],
      terminee: [],
      annulee: [],
    };
    for (const r of filtered) map[r.status]?.push(r);
    return map;
  }, [filtered]);

  const agendaDays = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const r of [...filtered].sort((a, b) => a.start_at.localeCompare(b.start_at))) {
      const k = dayKey(r.start_at);
      const arr = groups.get(k);
      if (arr) arr.push(r);
      else groups.set(k, [r]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, items }));
  }, [filtered]);

  const hasFilters =
    search.trim() !== "" || spaceF.size > 0 || statusF.size > 0;

  function resetFilters() {
    setSearch("");
    setSpaceF(new Set());
    setStatusF(new Set());
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(r: Reservation) {
    setEditing(r);
    setFormOpen(true);
  }

  function submitForm(values: ReservationFormValues) {
    const start = new Date(`${values.date}T${values.startTime}`);
    const end = new Date(`${values.date}T${values.endTime}`);
    const payload = {
      space_id: values.spaceId,
      person_id: values.personId || null,
      title: values.title || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: values.status,
      price: toNum(values.price),
      notes: values.notes.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateReservationAction(orgSlug, editing.id, payload)
        : await createReservationAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) {
        toast.success(editing ? "Réservation mise à jour" : "Réservation créée");
        setFormOpen(false);
        setEditing(null);
      } else if (res.conflict) {
        toast.error("Ce créneau chevauche une autre réservation sur cet espace.");
      } else {
        toast.error("Action impossible. Réessayez.");
      }
    });
  }

  function quickStatus(r: Reservation, status: ReservationStatus) {
    startTransition(async () => {
      const res = await updateReservationAction(orgSlug, r.id, { status });
      if (res.ok) {
        toast.success(`Réservation ${reservationStatusLabel(status).toLowerCase()}`);
      } else if (res.conflict) {
        toast.error("Ce créneau chevauche une autre réservation sur cet espace.");
      } else {
        toast.error("Action impossible. Réessayez.");
      }
    });
  }

  function doDelete(r: Reservation) {
    startTransition(async () => {
      const { ok } = await deleteReservationAction(orgSlug, r.id);
      if (ok) {
        toast.success("Réservation supprimée");
        setConfirmDelete(null);
        setSelectedId(null);
      } else {
        toast.error("Suppression impossible. Réessayez.");
      }
    });
  }

  // Carte de créneau réutilisable (kanban + agenda)
  function ResaCard({ r, withStatus }: { r: Reservation; withStatus?: boolean }) {
    const pName = personName(r.person_id);
    return (
      <button
        type="button"
        className={`mc-resa-card ${r.status === "annulee" ? "is-annulee" : ""}`}
        onClick={() => setSelectedId(r.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="mc-resa-title">{r.title || spaceName(r.space_id)}</span>
          {withStatus ? <StatusBadge status={r.status} /> : null}
        </div>
        <div className="mc-resa-line">
          <Clock className="size-3.5" /> {formatRange(r.start_at, r.end_at)}
        </div>
        <div className="mc-resa-line">
          <MapPin className="size-3.5" /> {spaceName(r.space_id)}
          {pName ? (
            <>
              <span className="mc-resa-dot" />
              <User className="size-3.5" /> {pName}
            </>
          ) : null}
        </div>
      </button>
    );
  }

  // État vide global
  if (reservations.length === 0) {
    return (
      <>
        <div className="mc-card">
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <CalendarClock className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucune réservation pour le moment</div>
            <p className="mc-empty-sub">
              {spaces.length === 0
                ? "Ajoutez d'abord un espace au catalogue, puis planifiez vos premiers créneaux."
                : "Planifiez vos premiers créneaux : ateliers, événements, coworking… avec détection automatique des chevauchements."}
            </p>
            {spaces.length > 0 ? (
              <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={openCreate}>
                <Plus className="size-3.5" /> Nouvelle réservation
              </button>
            ) : null}
          </div>
        </div>
        <ReservationForm
          key={formOpen ? "create-open" : "create-closed"}
          open={formOpen}
          reservation={null}
          spaces={spaces}
          persons={persons}
          busy={pending}
          onClose={() => setFormOpen(false)}
          onSubmit={submitForm}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat">
          <div className="mc-stat-val">{kpis.total}</div>
          <div className="mc-stat-lbl">Réservations</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>{kpis.today}</div>
          <div className="mc-stat-lbl">Aujourd&apos;hui</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.demandees}</div>
          <div className="mc-stat-lbl">Demandées</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.confirmees}</div>
          <div className="mc-stat-lbl">Confirmées</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#c2452f" }}>{kpis.annulees}</div>
          <div className="mc-stat-lbl">Annulées</div>
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
              placeholder="Rechercher par intitulé, espace, personne…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mc-view-toggle">
            <button
              type="button"
              className={`mc-view-btn ${view === "kanban" ? "active" : ""}`}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="size-3.5" /> Kanban
            </button>
            <button
              type="button"
              className={`mc-view-btn ${view === "agenda" ? "active" : ""}`}
              onClick={() => setView("agenda")}
            >
              <CalendarDays className="size-3.5" /> Agenda
            </button>
            <button
              type="button"
              className={`mc-view-btn ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
            >
              <List className="size-3.5" /> Tableau
            </button>
          </div>
          <button
            type="button"
            className="mc-btn mc-btn-lime mc-btn-sm"
            onClick={openCreate}
            disabled={spaces.length === 0}
          >
            <Plus className="size-3.5" /> Nouvelle
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
          <span className="mc-filter-lbl">Espace</span>
          <div className="mc-chips">
            {spaces.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`mc-chip ${spaceF.has(s.id) ? "active" : ""}`}
                onClick={() => setSpaceF((set) => toggle(set, s.id))}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">
            {RESERVATION_STATUSES.map((s) => (
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
      </div>

      {/* Résultats */}
      {filtered.length === 0 ? (
        <div className="mc-card">
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Search className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun résultat</div>
            <p className="mc-empty-sub">Aucune réservation ne correspond à ces filtres.</p>
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={resetFilters}>
              <RotateCcw className="size-3.5" /> Réinitialiser les filtres
            </button>
          </div>
        </div>
      ) : view === "kanban" ? (
        <div className="mc-kanban">
          {KANBAN_ORDER.map((status) => (
            <div key={status} className="mc-kanban-col">
              <div className="mc-kanban-head">
                <span className="mc-kanban-title">
                  <span
                    className="mc-kanban-dot"
                    style={{ background: COLUMN_DOT[status] }}
                  />
                  {reservationStatusLabel(status)}
                </span>
                <span className="mc-kanban-count">{byStatus[status].length}</span>
              </div>
              {byStatus[status].length === 0 ? (
                <div className="mc-kanban-empty">—</div>
              ) : (
                byStatus[status].map((r) => <ResaCard key={r.id} r={r} />)
              )}
            </div>
          ))}
        </div>
      ) : view === "agenda" ? (
        <div className="mc-card px-5 py-2">
          <div className="mc-agenda">
            {agendaDays.map(({ key, items }) => (
              <div key={key} className="mc-agenda-day">
                <div>
                  <div
                    className={`mc-agenda-date ${isToday(items[0].start_at) ? "is-today" : ""}`}
                  >
                    {formatDayLong(items[0].start_at)}
                  </div>
                  <div className="mc-agenda-date-sub">
                    {items.length} créneau{items.length > 1 ? "x" : ""}
                  </div>
                </div>
                <div className="mc-agenda-items">
                  {items.map((r) => (
                    <ResaCard key={r.id} r={r} withStatus />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mc-card overflow-hidden">
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Créneau</th>
                  <th>Espace</th>
                  <th>Réservant·e</th>
                  <th>Statut</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort((a, b) => a.start_at.localeCompare(b.start_at))
                  .map((r) => (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)}>
                      <td>
                        <span className="font-semibold text-foreground">
                          {r.title || spaceName(r.space_id)}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-warmgray">
                          {formatRange(r.start_at, r.end_at)}
                        </span>
                      </td>
                      <td className="text-[12px] text-warmgray">{spaceName(r.space_id)}</td>
                      <td className="text-[12px] text-warmgray">
                        {personName(r.person_id) ?? "—"}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-[12px] text-warmgray">{formatPrice(r.price)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer détail */}
      {selected ? (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="mc-drawer-ov"
            onClick={() => setSelectedId(null)}
          />
          <aside className="mc-drawer" aria-label="Fiche réservation">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">
                  {selected.title || spaceName(selected.space_id)}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={selected.status} />
                  <span className={`mc-badge ${typeBadge(spaceById.get(selected.space_id)?.type ?? "")}`}>
                    {typeLabel(spaceById.get(selected.space_id)?.type ?? "—")}
                  </span>
                </div>
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
              <div className="rounded-xl bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarClock className="size-4 text-warmgray" />
                  {formatRange(selected.start_at, selected.end_at)}
                </div>
                <div className="mt-1 text-[12px] text-warmgray">
                  Durée : {durationLabel(selected.start_at, selected.end_at)}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Espace</dt>
                  <dd className="mt-0.5 font-medium">{spaceName(selected.space_id)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Réservant·e</dt>
                  <dd className="mt-0.5 font-medium">{personName(selected.person_id) ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Prix</dt>
                  <dd className="mt-0.5 font-medium">{formatPrice(selected.price)}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-foreground">
                  {selected.notes ?? "—"}
                </p>
              </div>

              {/* Actions rapides de statut */}
              <div className="flex flex-wrap gap-2">
                {selected.status === "demandee" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quickStatus(selected, "confirmee")}
                    className="mc-btn mc-btn-outline mc-btn-sm"
                  >
                    <CheckCircle2 className="size-3.5" /> Confirmer
                  </button>
                ) : null}
                {selected.status === "confirmee" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quickStatus(selected, "terminee")}
                    className="mc-btn mc-btn-outline mc-btn-sm"
                  >
                    <CheckCircle2 className="size-3.5" /> Marquer terminée
                  </button>
                ) : null}
                {selected.status !== "annulee" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quickStatus(selected, "annulee")}
                    className="mc-btn mc-btn-outline mc-btn-sm"
                  >
                    <Ban className="size-3.5" /> Annuler
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button
                type="button"
                disabled={pending}
                onClick={() => openEdit(selected)}
                className="mc-btn mc-btn-lime flex-1"
              >
                <Pencil className="size-4" /> Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(selected)}
                className="mc-btn mc-btn-outline"
              >
                <Trash2 className="size-4" /> Supprimer
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Formulaire création / édition */}
      <ReservationForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen}
        reservation={editing}
        spaces={spaces}
        persons={persons}
        busy={pending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submitForm}
      />

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Supprimer cette réservation ?"
        message={
          confirmDelete
            ? `« ${confirmDelete.title || spaceName(confirmDelete.space_id)} » sera définitivement supprimée. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        tone="danger"
        busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
    </div>
  );
}
