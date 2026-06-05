"use client";

import { useEffect, useState } from "react";
import { X, Globe } from "lucide-react";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/events-meta";
import type { Evenement, Space } from "@/lib/types";

export interface EventFormValues {
  title: string;
  type: string;
  status: Evenement["status"];
  spaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
  price: string;
  description: string;
  photosInput: string;
  showOnPublicSite: boolean;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function localDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromEvenement(e: Evenement | null, defaultSpaceId: string): EventFormValues {
  if (!e) {
    return { title: "", type: "autre", status: "brouillon", spaceId: defaultSpaceId,
      date: localDate(new Date()), startTime: "18:00", endTime: "21:00",
      capacity: "", price: "", description: "", photosInput: "", showOnPublicSite: false };
  }
  const s = new Date(e.start_at); const en = new Date(e.end_at);
  return {
    title: e.title, type: e.type, status: e.status, spaceId: e.space_id ?? "",
    date: localDate(s),
    startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
    endTime: `${pad(en.getHours())}:${pad(en.getMinutes())}`,
    capacity: e.capacity != null ? String(e.capacity) : "",
    price: e.price != null ? String(e.price) : "",
    description: e.description ?? "",
    photosInput: e.photos.join(", "),
    showOnPublicSite: e.show_on_public_site ?? false,
  };
}

export function EventForm({ open, evenement, spaces, busy = false, onSubmit, onClose }: {
  open: boolean; evenement: Evenement | null; spaces: Space[];
  busy?: boolean; onSubmit: (v: EventFormValues) => void; onClose: () => void;
}) {
  const defaultSpaceId = evenement?.space_id ?? spaces[0]?.id ?? "";
  const [values, setValues] = useState<EventFormValues>(fromEvenement(evenement, defaultSpaceId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  function set<K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function submit() {
    setError(null);
    if (!values.title.trim()) { setError("Le titre est obligatoire."); return; }
    if (!values.date) { setError("La date est obligatoire."); return; }
    if (values.endTime <= values.startTime) { setError("L'heure de fin doit être après le début."); return; }
    if (values.capacity.trim()) {
      const n = Number(values.capacity.trim());
      if (Number.isNaN(n) || n < 0) { setError("La capacité doit être un nombre positif."); return; }
    }
    if (values.price.trim()) {
      const n = Number(values.price.trim().replace(",", "."));
      if (Number.isNaN(n) || n < 0) { setError("Le prix doit être un nombre positif."); return; }
    }
    onSubmit({ ...values, title: values.title.trim() });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true"
        aria-label={evenement ? "Modifier l'événement" : "Nouvel événement"}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {evenement ? "Modifier l'événement" : "Nouvel événement"}
          </h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group">
            <label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={values.title} autoFocus
              onChange={(e) => set("title", e.target.value)}
              placeholder="Vernissage, Atelier poterie, Marché…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Type</label>
              <select className="mc-input" value={values.type} onChange={(e) => set("type", e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select className="mc-input" value={values.status}
                onChange={(e) => set("status", e.target.value as Evenement["status"])}>
                {EVENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Espace (optionnel)</label>
            <select className="mc-input" value={values.spaceId} onChange={(e) => set("spaceId", e.target.value)}>
              <option value="">— Aucun espace —</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Date *</label>
            <input className="mc-input" type="date" value={values.date}
              onChange={(e) => set("date", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Début *</label>
              <input className="mc-input" type="time" value={values.startTime}
                onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Fin *</label>
              <input className="mc-input" type="time" value={values.endTime}
                onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Capacité (pers.)</label>
              <input className="mc-input" inputMode="numeric" value={values.capacity}
                onChange={(e) => set("capacity", e.target.value)} placeholder="ex. 50" />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Prix (€ / 0 = libre)</label>
              <input className="mc-input" inputMode="decimal" value={values.price}
                onChange={(e) => set("price", e.target.value)} placeholder="ex. 8" />
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Photos (URLs séparées par des virgules)</label>
            <input className="mc-input" value={values.photosInput}
              onChange={(e) => set("photosInput", e.target.value)}
              placeholder="https://… , https://…" />
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Description</label>
            <textarea className="mc-textarea" value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Programme, accès, informations pratiques…" />
          </div>

          {/* Toggle site public */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-peach-pale px-4 py-3 transition-colors hover:border-coral/40">
            <input
              type="checkbox"
              checked={values.showOnPublicSite}
              onChange={(e) => set("showOnPublicSite", e.target.checked)}
              className="size-4 accent-coral"
            />
            <Globe className="size-4 text-coral-dark" />
            <span className="text-[13px] font-semibold text-ink">Afficher sur le site public</span>
            {values.showOnPublicSite && (
              <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">Visible</span>
            )}
          </label>

          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : evenement ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
