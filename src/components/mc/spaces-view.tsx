"use client";

import { useMemo, useState, useTransition } from "react";
import {
  X,
  Search,
  RotateCcw,
  Plus,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Users,
  Ruler,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { SpaceForm, type SpaceFormValues } from "@/components/mc/space-form";
import {
  SPACE_STATUSES,
  SPACE_TYPES,
  typeBadge,
  typeLabel,
  spaceStatusBadge,
  spaceStatusLabel,
  priceSummary,
  formatPrice,
  formatCapacity,
  formatArea,
  spaceInitials,
} from "@/lib/spaces-meta";
import {
  createSpaceAction,
  deleteSpaceAction,
  updateSpaceAction,
} from "@/app/(admin)/dashboard/[org]/espaces/actions";
import type { Space, Establishment } from "@/lib/types";

type View = "cards" | "table";

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

function TypeBadge({ type }: { type: string }) {
  return <span className={`mc-badge ${typeBadge(type)}`}>{typeLabel(type)}</span>;
}
function StatusBadge({ status }: { status: string }) {
  return <span className={`mc-badge ${spaceStatusBadge(status)}`}>{spaceStatusLabel(status)}</span>;
}

/** Couverture photo (ou placeholder dégradé à initiales). */
function Cover({ space, children }: { space: Space; children?: React.ReactNode }) {
  const url = space.photos?.[0];
  return (
    <div
      className={`mc-space-cover${url ? "" : " mc-space-cover-ph"}`}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
    >
      {url ? null : spaceInitials(space.name)}
      {children}
    </div>
  );
}

export function SpacesView({
  spaces,
  establishments = [],
  orgSlug,
  orgId,
}: {
  spaces: Space[];
  establishments?: Establishment[];
  orgSlug: string;
  orgId: string;
}) {
  const [view, setView] = useState<View>("cards");
  const [estFilter, setEstFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Space | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Space | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = spaces.find((s) => s.id === selectedId) ?? null;

  const kpis = useMemo(() => {
    const dispo = spaces.filter((s) => s.status === "disponible");
    const sum = (arr: Space[], k: "capacity" | "area") =>
      arr.reduce((acc, s) => acc + (s[k] ?? 0), 0);
    return {
      total: spaces.length,
      dispo: dispo.length,
      capacity: sum(spaces, "capacity"),
      area: sum(spaces, "area"),
      maintenance: spaces.filter((s) => s.status === "maintenance").length,
    };
  }, [spaces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spaces.filter((s) => {
      if (estFilter !== "all" && (s.establishment_id ?? "none") !== estFilter) return false;
      if (typeF.size && !typeF.has(s.type)) return false;
      if (statusF.size && !statusF.has(s.status)) return false;
      if (q) {
        const hay = [s.name, s.description, typeLabel(s.type)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [spaces, search, typeF, statusF, estFilter]);

  const hasFilters = search.trim() !== "" || typeF.size > 0 || statusF.size > 0;

  function resetFilters() {
    setSearch("");
    setTypeF(new Set());
    setStatusF(new Set());
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Space) {
    setEditing(s);
    setFormOpen(true);
  }

  function submitForm(values: SpaceFormValues) {
    startTransition(async () => {
      const payload = {
        name: values.name,
        type: values.type,
        status: values.status,
        capacity: toNum(values.capacity),
        area: toNum(values.area),
        price_hour: toNum(values.priceHour),
        price_day: toNum(values.priceDay),
        description: values.description.trim() || null,
        photos: values.photos,
        establishment_id: values.establishmentId || null,
      };
      const res = editing
        ? await updateSpaceAction(orgSlug, editing.id, payload)
        : await createSpaceAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) {
        toast.success(editing ? "Espace mis à jour" : "Espace ajouté");
        setFormOpen(false);
        setEditing(null);
      } else {
        toast.error("Action impossible. Réessayez.");
      }
    });
  }

  function doDelete(s: Space) {
    startTransition(async () => {
      const { ok } = await deleteSpaceAction(orgSlug, s.id);
      if (ok) {
        toast.success("Espace supprimé");
        setConfirmDelete(null);
        setSelectedId(null);
      } else {
        toast.error("Suppression impossible. Réessayez.");
      }
    });
  }

  // État vide global
  if (spaces.length === 0) {
    return (
      <>
        <div className="mc-card">
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Building2 className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun espace pour le moment</div>
            <p className="mc-empty-sub">
              Constituez le catalogue du lieu : salles, ateliers, bureaux, espaces extérieurs…
              chacun avec photo, capacité et tarif.
            </p>
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={openCreate}>
              <Plus className="size-3.5" /> Ajouter un espace
            </button>
          </div>
        </div>
        <SpaceForm
          key={formOpen ? "create-open" : "create-closed"}
          open={formOpen}
          space={null}
          establishments={establishments}
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
          <div className="mc-stat-lbl">Espaces</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.dispo}</div>
          <div className="mc-stat-lbl">Disponibles</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.capacity}</div>
          <div className="mc-stat-lbl">Capacité totale</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#6b3aa0" }}>{kpis.area}</div>
          <div className="mc-stat-lbl">Surface (m²)</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.maintenance}</div>
          <div className="mc-stat-lbl">En maintenance</div>
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
              placeholder="Rechercher par nom, type, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mc-view-toggle">
            <button
              type="button"
              className={`mc-view-btn ${view === "cards" ? "active" : ""}`}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="size-3.5" /> Cartes
            </button>
            <button
              type="button"
              className={`mc-view-btn ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
            >
              <List className="size-3.5" /> Tableau
            </button>
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={openCreate}>
            <Plus className="size-3.5" /> Ajouter
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

        {establishments.length > 1 && (
          <div className="mc-filter-row">
            <span className="mc-filter-lbl">Lieu</span>
            <div className="mc-chips">
              <button type="button" className={`mc-chip ${estFilter === "all" ? "active" : ""}`} onClick={() => setEstFilter("all")}>Tous les lieux</button>
              {establishments.map((es) => (
                <button key={es.id} type="button" className={`mc-chip ${estFilter === es.id ? "active" : ""}`} onClick={() => setEstFilter(es.id)}>{es.name}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">
            {SPACE_TYPES.map((t) => (
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
            {SPACE_STATUSES.map((s) => (
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
      <div className="mc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="text-[13px] font-semibold text-foreground">
            {filtered.length} espace{filtered.length > 1 ? "s" : ""}
            {hasFilters ? ` / ${spaces.length}` : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Search className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun résultat</div>
            <p className="mc-empty-sub">Aucun espace ne correspond à ces filtres.</p>
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={resetFilters}>
              <RotateCcw className="size-3.5" /> Réinitialiser les filtres
            </button>
          </div>
        ) : view === "cards" ? (
          <div className="mc-cards-grid">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className="mc-space-card"
                onClick={() => setSelectedId(s.id)}
              >
                <Cover space={s}>
                  <div className="mc-space-badges">
                    <TypeBadge type={s.type} />
                    {s.status !== "disponible" ? <StatusBadge status={s.status} /> : null}
                  </div>
                </Cover>
                <div className="mc-space-body">
                  <div className="truncate font-semibold text-foreground">{s.name}</div>
                  <div className="mc-space-meta">
                    <span className="mc-space-meta-item">
                      <Users className="size-3.5" /> {formatCapacity(s.capacity)}
                    </span>
                    <span className="mc-space-meta-item">
                      <Ruler className="size-3.5" /> {formatArea(s.area)}
                    </span>
                  </div>
                  <div className="mc-space-price">{priceSummary(s.price_hour, s.price_day)}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Espace</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Capacité</th>
                  <th>Tarif / jour</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => setSelectedId(s.id)}>
                    <td>
                      <span className="font-semibold text-foreground">{s.name}</span>
                    </td>
                    <td>
                      <TypeBadge type={s.type} />
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-[12px] text-warmgray">{formatCapacity(s.capacity)}</td>
                    <td className="text-[12px] text-warmgray">{formatPrice(s.price_day)}</td>
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
          <aside className="mc-drawer" aria-label="Fiche espace">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={selected.type} />
                  <StatusBadge status={selected.status} />
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
              {selected.photos?.[0] ? (
                <div
                  className="mc-space-hero"
                  style={{ backgroundImage: `url("${selected.photos[0]}")` }}
                />
              ) : null}

              <dl className="grid grid-cols-2 gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Capacité</dt>
                  <dd className="mt-0.5 font-medium">{formatCapacity(selected.capacity)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Surface</dt>
                  <dd className="mt-0.5 font-medium">{formatArea(selected.area)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Tarif / heure</dt>
                  <dd className="mt-0.5 font-medium">{formatPrice(selected.price_hour)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Tarif / jour</dt>
                  <dd className="mt-0.5 font-medium">{formatPrice(selected.price_day)}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Description</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-foreground">
                  {selected.description ?? "—"}
                </p>
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
      <SpaceForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen}
        space={editing}
        establishments={establishments}
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
        title="Supprimer cet espace ?"
        message={
          confirmDelete
            ? `« ${confirmDelete.name} » sera définitivement retiré du catalogue. Cette action est irréversible.`
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
