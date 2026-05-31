"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RESERVATION_STATUSES } from "@/lib/reservations-meta";
import type { Person, Reservation, Space } from "@/lib/types";

export interface ReservationFormValues {
  title: string;
  spaceId: string;
  personId: string; // "" = aucune personne rattachée
  date: string; // YYYY-MM-DD (local)
  startTime: string; // HH:MM (local)
  endTime: string; // HH:MM (local)
  status: Reservation["status"];
  price: string;
  notes: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extrait date + heures locales d'une réservation existante. */
function fromReservation(
  r: Reservation | null,
  defaultSpaceId: string
): ReservationFormValues {
  if (!r) {
    return {
      title: "",
      spaceId: defaultSpaceId,
      personId: "",
      date: localDate(new Date()),
      startTime: "09:00",
      endTime: "12:00",
      status: "demandee",
      price: "",
      notes: "",
    };
  }
  const start = new Date(r.start_at);
  const end = new Date(r.end_at);
  return {
    title: r.title ?? "",
    spaceId: r.space_id,
    personId: r.person_id ?? "",
    date: localDate(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    status: r.status,
    price: r.price != null ? String(r.price) : "",
    notes: r.notes ?? "",
  };
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Modale de création / édition d'une réservation (primitive v1.7).
 * `reservation = null` → création ; sinon → édition pré-remplie.
 * Le parent remonte ce composant via une `key` pour garantir un état frais.
 */
export function ReservationForm({
  open,
  reservation,
  spaces,
  persons,
  busy = false,
  onSubmit,
  onClose,
}: {
  open: boolean;
  reservation: Reservation | null;
  spaces: Space[];
  persons: Person[];
  busy?: boolean;
  onSubmit: (values: ReservationFormValues) => void;
  onClose: () => void;
}) {
  const defaultSpaceId = reservation?.space_id ?? spaces[0]?.id ?? "";
  const [values, setValues] = useState<ReservationFormValues>(
    fromReservation(reservation, defaultSpaceId)
  );
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

  function set<K extends keyof ReservationFormValues>(
    key: K,
    v: ReservationFormValues[K]
  ) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function submit() {
    setError(null);
    if (!values.spaceId) {
      setError("Choisissez un espace à réserver.");
      return;
    }
    if (!values.date) {
      setError("La date est obligatoire.");
      return;
    }
    if (!values.startTime || !values.endTime) {
      setError("Les heures de début et de fin sont obligatoires.");
      return;
    }
    if (values.endTime <= values.startTime) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    if (values.price.trim()) {
      const n = Number(values.price.trim().replace(",", "."));
      if (Number.isNaN(n) || n < 0) {
        setError("Le prix doit être un nombre positif.");
        return;
      }
    }
    onSubmit({ ...values, title: values.title.trim() });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={reservation ? "Modifier la réservation" : "Nouvelle réservation"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {reservation ? "Modifier la réservation" : "Nouvelle réservation"}
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
            <label className="mc-form-label">Intitulé</label>
            <input
              className="mc-input"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Atelier poterie, Concert, Réunion…"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Espace *</label>
              <select
                className="mc-input"
                value={values.spaceId}
                onChange={(e) => set("spaceId", e.target.value)}
              >
                {spaces.length === 0 ? <option value="">Aucun espace</option> : null}
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Réservant·e</label>
              <select
                className="mc-input"
                value={values.personId}
                onChange={(e) => set("personId", e.target.value)}
              >
                <option value="">— Aucune —</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Date *</label>
            <input
              className="mc-input"
              type="date"
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Début *</label>
              <input
                className="mc-input"
                type="time"
                value={values.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Fin *</label>
              <input
                className="mc-input"
                type="time"
                value={values.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select
                className="mc-input"
                value={values.status}
                onChange={(e) => set("status", e.target.value as Reservation["status"])}
              >
                {RESERVATION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Prix (€)</label>
              <input
                className="mc-input"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="ex. 120"
              />
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Notes</label>
            <textarea
              className="mc-textarea"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Détails, matériel, conditions d'accès…"
            />
          </div>

          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : reservation ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
