"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Archive, ZoomIn, StickyNote, Save } from "lucide-react";
import { updateFeedbackStatus, saveAdminNote, type FeedbackStatus } from "@/app/admin/feedback/actions";
import type { FeedbackRow } from "@/lib/admin/data";

const PRIORITY_CLS: Record<string, string> = {
  low:      "bg-slate-100 text-slate-600",
  medium:   "bg-amber-50 text-amber-700",
  high:     "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open:     { label: "Ouvert",   cls: "bg-coral text-white" },
  accepted: { label: "Accepté",  cls: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archivé",  cls: "bg-slate-200 text-slate-600" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const FILTERS = [
  { key: "all",      label: "Tous" },
  { key: "open",     label: "Ouverts" },
  { key: "accepted", label: "Acceptés" },
  { key: "archived", label: "Archivés" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function FeedbackList({ items: initialItems }: { items: FeedbackRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("open");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // items locaux pour retrait immédiat des refusés sans attendre revalidate
  const [items, setItems] = useState<FeedbackRow[]>(initialItems);
  // Notes en cours d'édition : Map id → valeur textarea
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialItems.map((f) => [f.id, f.admin_note ?? ""]))
  );
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((f) => f.status === filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const f of items) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  }, [items]);

  function setStatus(id: string, status: FeedbackStatus, msg: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await updateFeedbackStatus(id, status);
      setBusyId(null);
      if (res.ok) {
        toast.success(msg);
        if (status === "refused") {
          // Retrait immédiat de la liste
          setItems((prev) => prev.filter((f) => f.id !== id));
        } else {
          setItems((prev) => prev.map((f) => f.id === id ? { ...f, status } : f));
        }
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  async function handleSaveNote(id: string) {
    setSavingNote(id);
    const res = await saveAdminNote(id, notes[id] ?? "");
    setSavingNote(null);
    if (res.ok) {
      toast.success("Note enregistrée ✓");
      setOpenNoteId(null);
      setItems((prev) => prev.map((f) => f.id === id ? { ...f, admin_note: notes[id] || null } : f));
    } else {
      toast.error(res.error ?? "Erreur");
    }
  }

  return (
    <>
      {/* Lightbox screenshot */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Capture d'écran" className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
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
            {(counts[f.key] ?? 0) > 0 && (
              <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
            )}
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
            const sm = STATUS_META[f.status] ?? STATUS_META.open;
            const isBusy = busyId === f.id && pending;
            const noteOpen = openNoteId === f.id;
            return (
              <li key={f.id} className="rounded-2xl border border-border bg-white p-4 transition">
                {/* En-tête : badges + statut */}
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${f.type === "bug" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {f.type === "bug" ? "🐛 Bug" : "✨ Amélioration"}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLS[f.priority] ?? PRIORITY_CLS.medium}`}>
                    {f.priority}
                  </span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sm.cls}`}>{sm.label}</span>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-ink">{f.description}</p>

                {/* Note admin (si existante, affichée en compacte) */}
                {f.admin_note && !noteOpen && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                    <p className="flex-1 text-[12px] text-amber-800">{f.admin_note}</p>
                    <button onClick={() => setOpenNoteId(f.id)} className="text-[11px] text-amber-600 hover:underline">Modifier</button>
                  </div>
                )}

                {/* Formulaire note */}
                {noteOpen && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <textarea
                      rows={3}
                      value={notes[f.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      placeholder="Précise ta demande, tes priorités, tes contraintes…"
                      className="w-full resize-none rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-[13px] text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveNote(f.id)}
                        disabled={savingNote === f.id}
                        className="flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-coral-dark disabled:opacity-50"
                      >
                        <Save className="size-3.5" />{savingNote === f.id ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button onClick={() => { setOpenNoteId(null); setNotes((prev) => ({ ...prev, [f.id]: f.admin_note ?? "" })); }} className="text-[12px] text-warmgray hover:text-ink">Annuler</button>
                    </div>
                  </div>
                )}

                {/* Screenshot */}
                {f.screenshot_url && (
                  <button
                    type="button"
                    onClick={() => setLightbox(f.screenshot_url!)}
                    className="group relative mt-3 inline-flex overflow-hidden rounded-lg border border-border transition hover:border-coral/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.screenshot_url} alt="Capture" className="h-24 w-auto max-w-[280px] object-cover transition group-hover:opacity-90" />
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
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {/* Bouton Note */}
                  {!noteOpen && (
                    <button
                      onClick={() => setOpenNoteId(f.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12.5px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      <StickyNote className="size-3.5" /> {f.admin_note ? "Modifier la note" : "Ajouter une note"}
                    </button>
                  )}

                  {/* Accepter */}
                  {f.status === "open" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "accepted", "Ticket accepté ✓")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <Check className="size-3.5" /> Accepter
                    </button>
                  )}

                  {/* Archiver (= réalisé) */}
                  {(f.status === "open" || f.status === "accepted") && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "archived", "Archivé ✓")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-40"
                    >
                      <Archive className="size-3.5" /> Archiver
                    </button>
                  )}

                  {/* Rouvrir (depuis archived ou accepted) */}
                  {f.status !== "open" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setStatus(f.id, "open", "Ticket rouvert")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-warmgray transition-colors hover:border-coral/40 disabled:opacity-40"
                    >
                      ↩ Rouvrir
                    </button>
                  )}

                  {/* Refuser (suppression) */}
                  <button
                    disabled={isBusy}
                    onClick={() => {
                      if (confirm("Supprimer ce ticket définitivement ?")) {
                        setStatus(f.id, "refused", "Ticket supprimé");
                      }
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    <X className="size-3.5" /> Refuser
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
