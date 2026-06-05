"use client";

import { useMemo, useState, useTransition } from "react";
import {
  X, Search, RotateCcw, Plus, LayoutGrid, List,
  Pencil, Trash2, Clock, MapPin, CalendarDays,
  Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { EventForm, type EventFormValues } from "@/components/mc/event-form";
import { EventRegistrationsPanel } from "@/components/mc/event-registrations";
import { EventCalendar } from "@/components/mc/event-calendar";
import {
  EVENT_STATUSES, EVENT_TYPES,
  eventTypeLabel, eventTypeBadge, eventStatusLabel, eventStatusBadge,
  eventRange, eventDayLong, eventDayKey, isFuture, isThisWeek,
  eventInitials, formatEventPrice, formatCapacity,
} from "@/lib/events-meta";
import {
  createEvenementAction, deleteEvenementAction, updateEvenementAction,
} from "@/app/(admin)/dashboard/[org]/evenements/actions";
import type { Evenement, Space } from "@/lib/types";

type View = "cards" | "calendrier" | "agenda" | "table";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  if (n.has(v)) { n.delete(v); } else { n.add(v); }
  return n;
}
function toNum(s: string): number | null {
  const t = s.trim(); if (!t) return null;
  const n = Number(t.replace(",", ".")); return Number.isNaN(n) ? null : n;
}

function TypeBadge({ type }: { type: string }) {
  return <span className={`mc-badge ${eventTypeBadge(type)}`}>{eventTypeLabel(type)}</span>;
}
function StatusBadge({ status }: { status: string }) {
  return <span className={`mc-badge ${eventStatusBadge(status)}`}>{eventStatusLabel(status)}</span>;
}

function Cover({ ev, children }: { ev: Evenement; children?: React.ReactNode }) {
  const url = ev.photos?.[0];
  return (
    <div className={`mc-event-cover${url ? "" : " mc-event-cover-ph"}`}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}>
      {url ? null : eventInitials(ev.title)}
      {children}
    </div>
  );
}

export function EventsView({ evenements, spaces, orgSlug, orgId }: {
  evenements: Evenement[]; spaces: Space[]; orgSlug: string; orgId: string;
}) {
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Evenement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Evenement | null>(null);
  const [pending, startTransition] = useTransition();

  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const spaceName = (id: string | null) => id ? spaceById.get(id)?.name ?? "Espace inconnu" : null;
  const selected = evenements.find((e) => e.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: evenements.length,
    aVenir: evenements.filter((e) => e.status !== "annule" && isFuture(e.start_at)).length,
    publies: evenements.filter((e) => e.status === "publie").length,
    semaine: evenements.filter((e) => e.status !== "annule" && isThisWeek(e.start_at)).length,
    annules: evenements.filter((e) => e.status === "annule").length,
  }), [evenements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return evenements.filter((e) => {
      if (typeF.size && !typeF.has(e.type)) return false;
      if (statusF.size && !statusF.has(e.status)) return false;
      if (q) {
        const hay = [e.title, e.description, spaceName(e.space_id), eventTypeLabel(e.type)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenements, search, typeF, statusF, spaceById]);

  const agendaDays = useMemo(() => {
    const groups = new Map<string, Evenement[]>();
    for (const e of [...filtered].sort((a, b) => a.start_at.localeCompare(b.start_at))) {
      const k = eventDayKey(e.start_at);
      const arr = groups.get(k); if (arr) arr.push(e); else groups.set(k, [e]);
    }
    return [...groups.entries()].map(([, items]) => items);
  }, [filtered]);

  const hasFilters = search.trim() !== "" || typeF.size > 0 || statusF.size > 0;

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(e: Evenement) { setEditing(e); setFormOpen(true); }

  function submitForm(values: EventFormValues) {
    const start = new Date(`${values.date}T${values.startTime}`);
    const end = new Date(`${values.date}T${values.endTime}`);
    const payload = {
      space_id: values.spaceId || null,
      title: values.title,
      type: values.type,
      status: values.status,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      capacity: toNum(values.capacity),
      price: toNum(values.price),
      description: values.description.trim() || null,
      photos: values.photosInput.split(",").map((p) => p.trim()).filter(Boolean),
      show_on_public_site: values.showOnPublicSite,
    };
    startTransition(async () => {
      const res = editing
        ? await updateEvenementAction(orgSlug, editing.id, payload)
        : await createEvenementAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) {
        toast.success(editing ? "Événement mis à jour" : "Événement créé");
        setFormOpen(false); setEditing(null);
      } else {
        toast.error("Action impossible. Réessayez.");
      }
    });
  }

  function quickPublish(e: Evenement, status: Evenement["status"]) {
    startTransition(async () => {
      const res = await updateEvenementAction(orgSlug, e.id, { status });
      if (res.ok) toast.success(`Événement ${eventStatusLabel(status).toLowerCase()}`);
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function doDelete(e: Evenement) {
    startTransition(async () => {
      const { ok } = await deleteEvenementAction(orgSlug, e.id);
      if (ok) { toast.success("Événement supprimé"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible. Réessayez.");
    });
  }

  if (evenements.length === 0) {
    return (
      <>
        <div className="mc-card">
          <div className="mc-empty">
            <span className="mc-empty-ic"><CalendarDays className="size-6" strokeWidth={1.8} /></span>
            <div className="mc-empty-title">Aucun événement pour le moment</div>
            <p className="mc-empty-sub">Ateliers, concerts, expositions, marchés… créez votre programmation.</p>
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={openCreate}>
              <Plus className="size-3.5" /> Nouvel événement
            </button>
            <p className="mt-2 text-[11px] text-warmgray/60 max-w-xs">💡 Les événements publiés apparaissent automatiquement sur votre site public et sur casaminga.com</p>
          </div>
        </div>
        <EventForm key={formOpen ? "create-open" : "create-closed"} open={formOpen} evenement={null}
          spaces={spaces} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Événements</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>{kpis.aVenir}</div><div className="mc-stat-lbl">À venir</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.publies}</div><div className="mc-stat-lbl">Publiés</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.semaine}</div><div className="mc-stat-lbl">Cette semaine</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#c2452f" }}>{kpis.annules}</div><div className="mc-stat-lbl">Annulés</div></div>
      </div>

      {/* Toolbar */}
      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search">
            <span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="mc-view-toggle">
            <button type="button" className={`mc-view-btn ${view === "cards" ? "active" : ""}`} onClick={() => setView("cards")}><LayoutGrid className="size-3.5" /> Cartes</button>
            <button type="button" className={`mc-view-btn ${view === "calendrier" ? "active" : ""}`} onClick={() => setView("calendrier")}><CalendarDays className="size-3.5" /> Calendrier</button>
            <button type="button" className={`mc-view-btn ${view === "agenda" ? "active" : ""}`} onClick={() => setView("agenda")}><List className="size-3.5" /> Agenda</button>
            <button type="button" className={`mc-view-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}><List className="size-3.5" /> Tableau</button>
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={openCreate}><Plus className="size-3.5" /> Nouvel</button>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setSearch(""); setTypeF(new Set()); setStatusF(new Set()); }} disabled={!hasFilters}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Type</span>
          <div className="mc-chips">{EVENT_TYPES.map((t) => (
            <button key={t.value} type="button" className={`mc-chip ${typeF.has(t.value) ? "active" : ""}`} onClick={() => setTypeF((s) => toggle(s, t.value))}>{t.label}</button>
          ))}</div>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">{EVENT_STATUSES.map((s) => (
            <button key={s.value} type="button" className={`mc-chip ${statusF.has(s.value) ? "active" : ""}`} onClick={() => setStatusF((set) => toggle(set, s.value))}>{s.label}</button>
          ))}</div>
        </div>
      </div>

      {/* Résultats */}
      {filtered.length === 0 ? (
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><Search className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucun résultat</div>
          <p className="mc-empty-sub">Aucun événement ne correspond à ces filtres.</p>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={() => { setSearch(""); setTypeF(new Set()); setStatusF(new Set()); }}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div></div>
      ) : view === "cards" ? (
        <div className="mc-cards-grid">
          {filtered.map((e) => (
            <button key={e.id} type="button" className={`mc-event-card is-${e.status}`} onClick={() => setSelectedId(e.id)}>
              <Cover ev={e}>
                <div className="mc-event-badges">
                  <TypeBadge type={e.type} />
                  <StatusBadge status={e.status} />
                  {e.show_on_public_site && (
                    <span className="mc-badge bg-sky-100 text-sky-700" title="Visible sur le site public">🌐</span>
                  )}
                </div>
              </Cover>
              <div className="mc-event-body">
                <div className="mc-event-title">{e.title}</div>
                <div className="mc-event-meta">
                  <Clock className="size-3.5" /> {eventRange(e.start_at, e.end_at)}
                </div>
                {spaceName(e.space_id) ? (
                  <div className="mc-event-meta"><MapPin className="size-3.5" /> {spaceName(e.space_id)}</div>
                ) : null}
                <div className="mc-event-price">{formatEventPrice(e.price)}</div>
              </div>
            </button>
          ))}
        </div>
      ) : view === "calendrier" ? (
        <EventCalendar evenements={filtered} onSelect={(e) => setSelectedId(e.id)} />
      ) : view === "agenda" ? (
        <div className="mc-card px-5 py-2">
          <div className="mc-agenda">
            {agendaDays.map((items) => (
              <div key={eventDayKey(items[0].start_at)} className="mc-agenda-day">
                <div>
                  <div className="mc-agenda-date">{eventDayLong(items[0].start_at)}</div>
                  <div className="mc-agenda-date-sub">{items.length} événement{items.length > 1 ? "s" : ""}</div>
                </div>
                <div className="mc-agenda-items">
                  {items.map((e) => (
                    <button key={e.id} type="button" className={`mc-resa-card ${e.status === "annule" ? "is-annulee" : ""}`} onClick={() => setSelectedId(e.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="mc-resa-title">{e.title}</span>
                        <div className="flex gap-1"><TypeBadge type={e.type} /><StatusBadge status={e.status} /></div>
                      </div>
                      <div className="mc-resa-line"><Clock className="size-3.5" /> {eventRange(e.start_at, e.end_at)}</div>
                      {spaceName(e.space_id) ? <div className="mc-resa-line"><MapPin className="size-3.5" /> {spaceName(e.space_id)}</div> : null}
                    </button>
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
              <thead><tr><th>Événement</th><th>Type</th><th>Statut</th><th>Capacité</th><th>Prix</th></tr></thead>
              <tbody>
                {[...filtered].sort((a, b) => a.start_at.localeCompare(b.start_at)).map((e) => (
                  <tr key={e.id} onClick={() => setSelectedId(e.id)}>
                    <td>
                      <span className="font-semibold text-foreground">{e.title}</span>
                      <span className="mt-0.5 block text-[12px] text-warmgray">{eventRange(e.start_at, e.end_at)}</span>
                    </td>
                    <td><TypeBadge type={e.type} /></td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="text-[12px] text-warmgray">{formatCapacity(e.capacity)}</td>
                    <td className="text-[12px] text-warmgray">{formatEventPrice(e.price)}</td>
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
          <aside className="mc-drawer" aria-label="Fiche événement">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={selected.type} /><StatusBadge status={selected.status} />
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              {selected.photos?.[0] ? (
                <div className="mc-space-hero" style={{ backgroundImage: `url("${selected.photos[0]}")` }} />
              ) : null}
              <div className="rounded-xl bg-white p-4 text-sm">
                <div className="flex items-center gap-2 font-medium"><Clock className="size-4 text-warmgray" /> {eventRange(selected.start_at, selected.end_at)}</div>
                {spaceName(selected.space_id) ? <div className="mt-1.5 flex items-center gap-2 text-warmgray"><MapPin className="size-4" /> {spaceName(selected.space_id)}</div> : null}
              </div>
              <dl className="grid grid-cols-2 gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Capacité</dt><dd className="mt-0.5 font-medium">{formatCapacity(selected.capacity)}</dd></div>
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Prix</dt><dd className="mt-0.5 font-medium">{formatEventPrice(selected.price)}</dd></div>
              </dl>
              {selected.description ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Description</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.description}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {selected.status === "brouillon" ? (
                  <button type="button" disabled={pending} onClick={() => quickPublish(selected, "publie")} className="mc-btn mc-btn-outline mc-btn-sm"><Eye className="size-3.5" /> Publier</button>
                ) : null}
                {selected.status === "publie" ? (
                  <button type="button" disabled={pending} onClick={() => quickPublish(selected, "brouillon")} className="mc-btn mc-btn-outline mc-btn-sm"><EyeOff className="size-3.5" /> Dépublier</button>
                ) : null}
              </div>
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => openEdit(selected)} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
            <EventRegistrationsPanel event={selected} orgSlug={orgSlug} orgId={orgId} />
          </aside>
        </>
      ) : null}

      <EventForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} evenement={editing} spaces={spaces} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Supprimer cet événement ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimé. Cette action est irréversible.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
