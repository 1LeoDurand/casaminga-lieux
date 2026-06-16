"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PERSON_ROLES, PERSON_STATUSES } from "@/lib/persons-meta";
import type { Person, Establishment } from "@/lib/types";

export interface PersonFormValues {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: Person["status"];
  tags: string[];
  notes: string;
  establishment_id: string;
  sendWelcome: boolean;
}

function fromPerson(p: Person | null, defaultEstablishmentId: string | null): PersonFormValues {
  return {
    name: p?.name ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    role: p?.role ?? "membre",
    status: p?.status ?? "actif",
    tags: p?.tags ? [...p.tags] : [],
    notes: p?.notes ?? "",
    establishment_id: p?.establishment_id ?? defaultEstablishmentId ?? "",
    sendWelcome: false,
  };
}

/**
 * Modal de création / édition d'une personne (primitive de formulaire v1.5).
 * `person = null` → création ; sinon → édition pré-remplie.
 */
export function PersonForm({
  open,
  person,
  establishments = [],
  defaultEstablishmentId = null,
  busy = false,
  onSubmit,
  onClose,
}: {
  open: boolean;
  person: Person | null;
  establishments?: Establishment[];
  defaultEstablishmentId?: string | null;
  busy?: boolean;
  onSubmit: (values: PersonFormValues) => void;
  onClose: () => void;
}) {
  // Les champs sont initialisés depuis `person` au montage. Le parent remonte
  // ce composant via une `key` à chaque ouverture, garantissant un état frais.
  const [values, setValues] = useState<PersonFormValues>(fromPerson(person, defaultEstablishmentId));
  const [tagsInput, setTagsInput] = useState((person?.tags ?? []).join(", "));
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

  function set<K extends keyof PersonFormValues>(key: K, v: PersonFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function submit() {
    if (!values.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("L'adresse email n'est pas valide.");
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ ...values, name: values.name.trim(), tags });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={person ? "Modifier la personne" : "Ajouter une personne"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {person ? "Modifier la personne" : "Ajouter une personne"}
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
              placeholder="Prénom Nom"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Email</label>
              <input
                className="mc-input"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemple.org"
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Téléphone</label>
              <input
                className="mc-input"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+33 …"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Rôle</label>
              <select
                className="mc-input"
                value={values.role}
                onChange={(e) => set("role", e.target.value)}
              >
                {PERSON_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select
                className="mc-input"
                value={values.status}
                onChange={(e) => set("status", e.target.value as Person["status"])}
              >
                {PERSON_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Tags (séparés par des virgules)</label>
            <input
              className="mc-input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="céramique, résidence…"
            />
          </div>

          {establishments.length > 0 ? (
            <div className="mc-form-group">
              <label className="mc-form-label">Lieu de rattachement</label>
              <select
                className="mc-input"
                value={values.establishment_id}
                onChange={(e) => set("establishment_id", e.target.value)}
              >
                <option value="">— Aucun (commun à tous les lieux) —</option>
                {establishments.map((es) => (
                  <option key={es.id} value={es.id}>{es.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mc-form-group">
            <label className="mc-form-label">Notes</label>
            <textarea
              className="mc-textarea"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Informations utiles…"
            />
          </div>

          {!person && values.email.trim() ? (
            <label className="mc-form-group flex cursor-pointer flex-row items-center gap-2.5 rounded-xl border border-border bg-peach-pale/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={values.sendWelcome}
                onChange={(e) => set("sendWelcome", e.target.checked)}
                className="size-4 accent-coral"
              />
              <span className="text-[13px] text-foreground">
                Envoyer un email de bienvenue à <strong>{values.email.trim()}</strong>
              </span>
            </label>
          ) : null}

          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : person ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
