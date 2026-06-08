"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Globe, Compass, CalendarClock, Check, X, Clock, ExternalLink } from "lucide-react";
import { setLieuModeration, setEventPortalStatus } from "@/app/admin/moderation/actions";
import type { ModerationLieu, ModerationEvent, ModStatus } from "@/lib/admin/data";

const STATUSES: { value: ModStatus; label: string; on: string; off: string }[] = [
  { value: "approved", label: "Approuvé", on: "bg-emerald-600 text-white border-emerald-600", off: "text-emerald-700 border-border hover:border-emerald-300" },
  { value: "pending",  label: "En attente", on: "bg-amber-500 text-white border-amber-500", off: "text-amber-700 border-border hover:border-amber-300" },
  { value: "rejected", label: "Refusé", on: "bg-red-600 text-white border-red-600", off: "text-red-700 border-border hover:border-red-300" },
];

function StatusPicker({ value, onPick, busy }: { value: ModStatus; onPick: (s: ModStatus) => void; busy: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
      {STATUSES.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            disabled={busy}
            onClick={() => !active && onPick(s.value)}
            className={`rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-50 ${active ? s.on : `bg-white ${s.off}`}`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ModerationView({ lieux, events }: { lieux: ModerationLieu[]; events: ModerationEvent[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // État local optimiste
  const [lieuState, setLieuState] = useState<Record<string, { site: ModStatus; portal: ModStatus }>>(
    () => Object.fromEntries(lieux.map((l) => [l.id, { site: l.public_site_status, portal: l.portal_status }]))
  );
  const [eventState, setEventState] = useState<Record<string, ModStatus>>(
    () => Object.fromEntries(events.map((e) => [e.id, e.portal_status]))
  );

  const pendingPortal = useMemo(
    () => lieux.filter((l) => (lieuState[l.id]?.portal ?? l.portal_status) === "pending").length,
    [lieux, lieuState]
  );

  function pickLieu(id: string, field: "public_site_status" | "portal_status", status: ModStatus) {
    const key = field === "public_site_status" ? "site" : "portal";
    setBusyId(id + field);
    setLieuState((s) => ({ ...s, [id]: { ...s[id], [key]: status } }));
    startTransition(async () => {
      const res = await setLieuModeration(id, field, status);
      setBusyId(null);
      if (res.ok) toast.success("Statut mis à jour");
      else toast.error(res.error ?? "Échec");
    });
  }

  function pickEvent(id: string, status: ModStatus) {
    setBusyId(id);
    setEventState((s) => ({ ...s, [id]: status }));
    startTransition(async () => {
      const res = await setEventPortalStatus(id, status);
      setBusyId(null);
      if (res.ok) toast.success(status === "approved" ? "Événement publié sur le portail ✓" : "Événement écarté");
      else toast.error(res.error ?? "Échec");
    });
  }

  const visibleEvents = events.filter((e) => (eventState[e.id] ?? "pending") === "pending");

  return (
    <div className="space-y-8">
      {/* ── Lieux ── */}
      <section className="rounded-2xl border border-border bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Globe className="size-[18px] text-coral-dark" strokeWidth={1.9} />
            <h2 className="font-heading text-base font-bold text-ink">Lieux — site public &amp; portail</h2>
          </div>
          <span className="rounded-full bg-peach-pale px-2.5 py-1 text-[11px] font-semibold text-coral-dark">{lieux.length} lieu{lieux.length > 1 ? "x" : ""}</span>
        </div>

        {lieux.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-warmgray">Aucun lieu créé pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {lieux.map((l) => {
              const st = lieuState[l.id] ?? { site: l.public_site_status, portal: l.portal_status };
              return (
                <li key={l.id} className="px-5 py-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{l.name}</span>
                        {!l.active && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">inactif</span>}
                      </div>
                      <div className="truncate text-[12px] text-warmgray">
                        {l.org_name}{l.city ? ` · ${l.city}` : ""}
                      </div>
                    </div>
                    <a href={`/site/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-coral-dark hover:underline">
                      Voir la vitrine <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
                        <Globe className="size-3" /> Site public
                      </div>
                      <StatusPicker value={st.site} busy={busyId === l.id + "public_site_status" && pending} onPick={(s) => pickLieu(l.id, "public_site_status", s)} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
                        <Compass className="size-3" /> Portail casaminga.com
                      </div>
                      <StatusPicker value={st.portal} busy={busyId === l.id + "portal_status" && pending} onPick={(s) => pickLieu(l.id, "portal_status", s)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Événements à valider pour le portail ── */}
      <section className="rounded-2xl border border-border bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="size-[18px] text-coral-dark" strokeWidth={1.9} />
            <h2 className="font-heading text-base font-bold text-ink">Événements proposés au portail</h2>
          </div>
          <span className="rounded-full bg-peach-pale px-2.5 py-1 text-[11px] font-semibold text-coral-dark">{visibleEvents.length} en attente</span>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-warmgray">
            {pendingPortal > 0 ? "Aucun événement en attente. " : ""}Tout est traité ✓
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{e.title}</div>
                  <div className="flex items-center gap-1.5 truncate text-[12px] text-warmgray">
                    <Clock className="size-3" /> {fmtDate(e.start_at)} · {e.org_name}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId === e.id && pending}
                    onClick={() => pickEvent(e.id, "approved")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Publier
                  </button>
                  <button
                    type="button"
                    disabled={busyId === e.id && pending}
                    onClick={() => pickEvent(e.id, "rejected")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-warmgray transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                  >
                    <X className="size-3.5" /> Écarter
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
