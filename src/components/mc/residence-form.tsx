"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RESIDENCE_DISCIPLINES, RESIDENCE_STATUSES } from "@/lib/residences-meta";
import type { Artist, Person, Residence, Space } from "@/lib/types";

export interface ResidenceFormValues {
  title: string;
  discipline: string;
  status: Residence["status"];
  spaceId: string;
  personId: string;
  artistId: string;
  startDate: string;
  endDate: string;
  description: string;
  notes: string;
  budget: string;
  logementFourni: boolean;
  logementNotes: string;
  conventionSignee: boolean;
  conventionDate: string;
  restitutionDate: string;
  restitutionStatus: Residence["restitution_status"];
  projetDescription: string;
}

const RESTITUTION_STATUSES: { value: Residence["restitution_status"]; label: string }[] = [
  { value: "non_prevu", label: "Non prévu" },
  { value: "planifiee", label: "Planifiée" },
  { value: "realisee", label: "Réalisée" },
  { value: "annulee", label: "Annulée" },
];

function fromResidence(r: Residence | null): ResidenceFormValues {
  return {
    title: r?.title ?? "",
    discipline: r?.discipline ?? "autre",
    status: r?.status ?? "candidature",
    spaceId: r?.space_id ?? "",
    personId: r?.person_id ?? "",
    artistId: r?.artist_id ?? "",
    startDate: r?.start_date ?? "",
    endDate: r?.end_date ?? "",
    description: r?.description ?? "",
    notes: r?.notes ?? "",
    budget: r?.budget != null ? String(r.budget) : "",
    logementFourni: r?.logement_fourni ?? false,
    logementNotes: r?.logement_notes ?? "",
    conventionSignee: r?.convention_signee ?? false,
    conventionDate: r?.convention_date ?? "",
    restitutionDate: r?.restitution_date ?? "",
    restitutionStatus: r?.restitution_status ?? "non_prevu",
    projetDescription: r?.projet_description ?? "",
  };
}

export function ResidenceForm({
  open, residence, spaces, persons, artists, busy = false, onSubmit, onClose,
}: {
  open: boolean;
  residence: Residence | null;
  spaces: Space[];
  persons: Person[];
  artists: Artist[];
  busy?: boolean;
  onSubmit: (v: ResidenceFormValues) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ResidenceFormValues>(fromResidence(residence));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(fromResidence(residence));
    setError(null);
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, residence, busy, onClose]);

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

  const sectionTitle = (t: string) => (
    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-warmgray">{t}</p>
  );

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="mc-modal max-h-[90vh] overflow-y-auto"
        role="dialog" aria-modal="true"
        aria-label={residence ? "Modifier la résidence" : "Nouvelle résidence"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {residence ? "Modifier la résidence" : "Nouvelle résidence"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Informations de base */}
          {sectionTitle("Informations")}
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
              <label className="mc-form-label">Espace</label>
              <select className="mc-input" value={values.spaceId} onChange={(e) => set("spaceId", e.target.value)}>
                <option value="">— Aucun —</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Résident·e (CRM)</label>
              <select className="mc-input" value={values.personId} onChange={(e) => set("personId", e.target.value)}>
                <option value="">— Aucun —</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {artists.length > 0 && (
            <div className="mc-form-group">
              <label className="mc-form-label">Artiste (annuaire)</label>
              <select className="mc-input" value={values.artistId} onChange={(e) => set("artistId", e.target.value)}>
                <option value="">— Aucun —</option>
                {artists.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.discipline}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Début</label>
              <input className="mc-input" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Fin</label>
              <input className="mc-input" type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Description du projet</label>
            <textarea className="mc-textarea" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Présentation du projet artistique…" />
          </div>

          {/* Budget & logement */}
          {sectionTitle("Budget & accueil")}
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Budget (€)</label>
              <input className="mc-input" type="number" min="0" step="0.01" value={values.budget} onChange={(e) => set("budget", e.target.value)} placeholder="0.00" />
            </div>
            <div className="mc-form-group flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="size-4" checked={values.logementFourni} onChange={(e) => set("logementFourni", e.target.checked)} />
                <span className="text-sm font-medium text-foreground">Logement fourni</span>
              </label>
            </div>
          </div>
          {values.logementFourni && (
            <div className="mc-form-group">
              <label className="mc-form-label">Notes logement</label>
              <input className="mc-input" value={values.logementNotes} onChange={(e) => set("logementNotes", e.target.value)} placeholder="Chambre 2e étage, code : 1234…" />
            </div>
          )}

          {/* Convention */}
          {sectionTitle("Convention")}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="size-4" checked={values.conventionSignee} onChange={(e) => set("conventionSignee", e.target.checked)} />
              <span className="text-sm font-medium text-foreground">Convention signée</span>
            </label>
            {values.conventionSignee && (
              <div className="mc-form-group flex-1">
                <label className="mc-form-label">Date de signature</label>
                <input className="mc-input" type="date" value={values.conventionDate} onChange={(e) => set("conventionDate", e.target.value)} />
              </div>
            )}
          </div>

          {/* Restitution */}
          {sectionTitle("Restitution / Clôture")}
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Statut restitution</label>
              <select className="mc-input" value={values.restitutionStatus} onChange={(e) => set("restitutionStatus", e.target.value as Residence["restitution_status"])}>
                {RESTITUTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Date de restitution</label>
              <input className="mc-input" type="date" value={values.restitutionDate} onChange={(e) => set("restitutionDate", e.target.value)} />
            </div>
          </div>

          {/* Notes internes */}
          {sectionTitle("Notes internes")}
          <div className="mc-form-group">
            <textarea className="mc-textarea" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Conditions d'accueil, besoins, observations…" />
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
