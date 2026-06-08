"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Wrench, Clock, RotateCcw, ZoomIn } from "lucide-react";
import { updateFeedbackStatus, type FeedbackStatus } from "@/app/admin/feedback/actions";
import type { FeedbackRow } from "@/lib/admin/data";

/** Heuristique de triage : suggère une catégorie selon les règles définies. */
type Triage = "auto" | "ask" | "ignore";

function triageOf(f: FeedbackRow): Triage {
  const t = `${f.description} ${f.page_title ?? ""}`.toLowerCase();
  // Hors périmètre / vague → ignore
  if (f.description.trim().length < 8) return "ignore";
  // Changement éditorial / fonctionnalité → demande d'accord
  const askKeywords = ["change", "remplace", "renomme", "mot", "texte", "formulation", "wording", "ajoute", "supprime", "fonctionnalité", "feature", "préfère", "devrait", "pourrait", "idée", "couleur", "design"];
  if (f.type === "amélioration") return "ask";
  if (askKeywords.some((k) => t.includes(k))) return "ask";
  // Sinon (bug, faute, erreur technique) → auto
  return "auto";
}

const TRIAGE_META: Record<Triage, { label: string; cls: string; icon: string }> = {
  auto:   { label: "Traitable auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "✓" },
  ask:    { label: "Ton accord requis", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: "◎" },
  ignore: { label: "À ignorer ?", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: "✕" },
};

const PRIORITY_CLS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Nouveau", cls: "bg-coral text-white" },
  in_progress: { label: "En cours", cls: "bg-blue-100 text-blue-700" },
  resolved: { label: "Résolu", cls: "bg-emerald-100 text-emerald-700" },
  dismissed: { label: "Ignoré", cls: "bg-slate-200 text-slate-500" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "in_progress", label: "En cours" },
  { key: "resolved", label: "Résolus" },
  { key: "dismissed", label: "Ignorés" },
] as const;

export function FeedbackList({ items }: { items: FeedbackRow[] }) {
  const [filter, setFilter] = useState<string>("open");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((f) => f.status === filter)),
    [items, filter]
  );

  function setStatus(id: string, status: FeedbackStatus, msg: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await updateFeedbackStatus(id, status);
      setBusyId(null);
      if (res.ok) toast.success(msg);
      else toast.error(res.error ?? "Erreur");
    });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const f of items) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Capture d'écran"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap gap-2">
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
            {counts[f.key] ? <span className="ml-1.5 opacity-70">{counts[f.key]}</span> : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Aucun ticket dans cette catégorie.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((f) => {
            const triage = triageOf(f);
            const tm = TRIAGE_META[triage];
            const sm = STATUS_META[f.status] ?? STATUS_META.open;
            const isBusy = busyId === f.id && pending;
            return (
              <li key={f.id} className="rounded-2xl border border-border bg-white p-4">
                {/* En-tête : badges */}
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${f.type === "bug" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {f.type === "bug" ? "🐛 Bug" : "✨ Amélioration"}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLS[f.priority] ?? PRIORITY_CLS.medium}`}>
                    {f.priority}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tm.cls}`}>
                    {tm.icon} {tm.label}
                  </span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.cls}`}>{sm.label}</span>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-ink">{f.description}</p>

                {/* Screenshot */}
                {f.screenshot_url && (
                  <button
                    type="button"
                    onClick={() => setLightbox(f.screenshot_url!)}
                    className="group relative mt-3 inline-flex overflow-hidden rounded-lg border border-border transition hover:border-coral/40"
                    title="Voir la capture en plein écran"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.screenshot_url}
                      alt="Capture d'écran"
                      className="h-24 w-auto max-w-[280px] object-cover transition group-hover:opacity-90"
                    />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
                        <ZoomIn className="size-3.5" /> Agrandir
                      </span>
                    </span>
                  </button>
                )}

                {/* Méta */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-warmgray">
                  {f.org_slug && <span>🏛 {f.org_slug}</span>}
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-coral-dark hover:underline">
                      📍 {f.page_title || f.url}
                    </a>
                  )}
                  {/* Infos environnement */}
                  {f.os_hint && <span title={f.user_agent ?? undefined}>💻 {f.os_hint}</span>}
                  {f.device_type && f.device_type !== "desktop" && (
                    <span>{f.device_type === "mobile" ? "📱 Mobile" : "📱 Tablette"}</span>
                  )}
                  {f.screen_width && f.screen_height && (
                    <span className="font-mono text-[10.5px]">{f.screen_width}×{f.screen_height}</span>
                  )}
                  <span className="ml-auto">{fmtDate(f.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {f.status !== "in_progress" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "in_progress", "Marqué en cours")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-40"
                    >
                      <Clock className="size-3.5" /> En cours
                    </button>
                  )}
                  {f.status !== "resolved" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "resolved", "Ticket résolu ✓")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <Check className="size-3.5" /> Résolu
                    </button>
                  )}
                  {f.status !== "dismissed" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "dismissed", "Ticket ignoré")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-warmgray transition-colors hover:border-slate-300 disabled:opacity-40"
                    >
                      <X className="size-3.5" /> Ignorer
                    </button>
                  )}
                  {(f.status === "resolved" || f.status === "dismissed") && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "open", "Rouvert")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-warmgray transition-colors hover:border-coral/40 disabled:opacity-40"
                    >
                      <RotateCcw className="size-3.5" /> Rouvrir
                    </button>
                  )}
                  {triage === "auto" && f.status === "open" && (
                    <span className="ml-auto inline-flex items-center gap-1.5 self-center text-[11.5px] text-emerald-600">
                      <Wrench className="size-3.5" /> Dis « traite les tickets feedback » pour que je le corrige
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
