"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SPACE_STATUSES, SPACE_TYPES } from "@/lib/spaces-meta";
import type { Space, Establishment } from "@/lib/types";

export interface SpaceFormValues {
  name: string;
  type: string;
  status: Space["status"];
  capacity: string;
  area: string;
  priceHour: string;
  priceDay: string;
  description: string;
  photos: string[];
  establishmentId: string;
}

function fromSpace(s: Space | null): SpaceFormValues {
  return {
    name: s?.name ?? "",
    type: s?.type ?? "salle",
    status: s?.status ?? "disponible",
    capacity: s?.capacity != null ? String(s.capacity) : "",
    area: s?.area != null ? String(s.area) : "",
    priceHour: s?.price_hour != null ? String(s.price_hour) : "",
    priceDay: s?.price_day != null ? String(s.price_day) : "",
    description: s?.description ?? "",
    photos: s?.photos ? [...s.photos] : [],
    establishmentId: s?.establishment_id ?? "",
  };
}

/**
 * Modal de création / édition d'un espace (primitive de formulaire v1.6).
 * `space = null` → création ; sinon → édition pré-remplie.
 * Le parent remonte ce composant via une `key` pour garantir un état frais.
 */
export function SpaceForm({
  open,
  space,
  establishments = [],
  busy = false,
  onSubmit,
  onClose,
}: {
  open: boolean;
  space: Space | null;
  establishments?: Establishment[];
  busy?: boolean;
  onSubmit: (values: SpaceFormValues) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<SpaceFormValues>(fromSpace(space));
  const [photosInput, setPhotosInput] = useState((space?.photos ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  function set<K extends keyof SpaceFormValues>(key: K, v: SpaceFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function numericOrError(label: string, raw: string): number | null | "error" {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      setError(`${label} doit être un nombre positif.`);
      return "error";
    }
    return n;
  }

  function submit() {
    setError(null);
    if (!values.name.trim()) {
      setError("Le nom de l'espace est obligatoire.");
      return;
    }
    // Validation des champs numériques (les conversions réelles se font côté vue).
    for (const [label, raw] of [
      ["La capacité", values.capacity],
      ["La surface", values.area],
      ["Le tarif horaire", values.priceHour],
      ["Le tarif journalier", values.priceDay],
    ] as const) {
      if (numericOrError(label, raw) === "error") return;
    }
    const photos = photosInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    onSubmit({ ...values, name: values.name.trim(), photos });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={space ? "Modifier l'espace" : "Ajouter un espace"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {space ? "Modifier l'espace" : "Ajouter un espace"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group">
            <label className="mc-form-label">Nom *</label>
            <input
              className="mc-input"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Grande salle, Atelier céramique…"
              autoFocus
            />
          </div>

          {establishments.length > 1 && (
            <div className="mc-form-group">
              <label className="mc-form-label">Établissement / Lieu</label>
              <select className="mc-input" value={values.establishmentId} onChange={(e) => set("establishmentId", e.target.value)}>
                <option value="">— Non précisé —</option>
                {establishments.map((es) => <option key={es.id} value={es.id}>{es.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Type</label>
              <select
                className="mc-input"
                value={values.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {SPACE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select
                className="mc-input"
                value={values.status}
                onChange={(e) => set("status", e.target.value as Space["status"])}
              >
                {SPACE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Capacité (pers.)</label>
              <input
                className="mc-input"
                inputMode="numeric"
                value={values.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                placeholder="ex. 30"
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Surface (m²)</label>
              <input
                className="mc-input"
                inputMode="decimal"
                value={values.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="ex. 45"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Tarif / heure (€)</label>
              <input
                className="mc-input"
                inputMode="decimal"
                value={values.priceHour}
                onChange={(e) => set("priceHour", e.target.value)}
                placeholder="ex. 25"
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Tarif / jour (€)</label>
              <input
                className="mc-input"
                inputMode="decimal"
                value={values.priceDay}
                onChange={(e) => set("priceDay", e.target.value)}
                placeholder="ex. 150"
              />
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Photos (URLs séparées par des virgules)</label>
            <input
              className="mc-input"
              value={photosInput}
              onChange={(e) => setPhotosInput(e.target.value)}
              placeholder="https://… , https://…"
            />
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Description</label>
            <textarea
              className="mc-textarea"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Usage, équipements, ambiance…"
            />
          </div>

          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : space ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
