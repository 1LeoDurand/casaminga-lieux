"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RESIDENCE_DISCIPLINES, RESIDENCE_STATUSES } from "@/lib/residences-meta";
import type { Person, Residence, Space } from "@/lib/types";

export interface ResidenceFormValues {
  title: string;
  discipline: string;
  status: Residence["status"];
  spaceId: string;
  personId: string;
  startDate: string;
  endDate: string;
  description: string;
  notes: string;
}

function fromResidence(r: Residence | null): ResidenceFormValues {
  return {
    title: r?.title ?? "", discipline: r?.discipline ?? "autre",
    status: r?.status ?? "candidature", spaceId: r?.space_id ?? "",
    personId: r?.person_id ?? "", startDate: r?.start_date ?? "",
    endDate: r?.end_date ?? "", description: r?.description ?? "", notes: r?.notes ?? "",
  };
}

export function ResidenceForm({ open, residence, spaces, persons, busy = false, onSubmit, onClose }: {
  open: boolean; residence: Residence | null; spaces: Space[]; persons: Person[];
  busy?: boolean; onSubmit: (v: ResidenceFormValues) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<ResidenceFormValues>(fromResidence(residence));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, busy, onClose]);

  if (!open) return null;
  function set<K extends keyof ResidenceFormValues>(key: K, v: ResidenceFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function submit() {
    setError(null);
    if (!values.title.trim()) { setError("Le titre est obligatoire."); return; }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      setError("La date de fin doit être après le début."); return;
    }
    onSubmit({ ...values, title: values.title.trim() });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true"
        aria-label={residence ? "Modifier la résidence" : "Nouvelle résidence"}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {residence ? "Modifier la résidence" : "Nouvelle résidence"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group">
            <label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={values.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Résidence céramique — Nom de l'artiste…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Discipline</label>
              <select className="mc-input" value={values.discipline} onChange={(e) => set("discipline", e.target.value)}>
                {RESIDENCE_DISCIPLINES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select className="mc-input" value={values.status} onChange={(e) => set("status", e.target.value as Residence["status"])}>
                {RESIDENCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Espace (optionnel)</label>
              <select className="mc-input" value={values.spaceId} onChange={(e) => set("spaceId", e.target.value)}>
                <option value="">— Aucun —</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Artiste / Résident·e</label>
              <select className="mc-input" value={values.personId} onChange={(e) => set("personId", e.target.value)}>
                <option value="">— Aucun —</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Date de début</label>
              <input className="mc-input" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Date de fin</label>
              <input className="mc-input" type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Description du projet</label>
            <textarea className="mc-textarea" value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Présentation du projet artistique…" />
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Notes internes</label>
            <textarea className="mc-textarea" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Conditions d'accueil, besoins, observations…" />
          </div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : residence ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
