"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  TRANSACTION_CATEGORIES_RECETTE, TRANSACTION_CATEGORIES_DEPENSE,
  TRANSACTION_STATUSES,
} from "@/lib/finances-meta";
import type { Person, Transaction } from "@/lib/types";

export interface TransactionFormValues {
  type: Transaction["type"]; category: string; label: string;
  amount: string; date: string; status: Transaction["status"];
  personId: string; notes: string;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromTx(t: Transaction | null): TransactionFormValues {
  return {
    type: t?.type ?? "recette", category: t?.category ?? "autre",
    label: t?.label ?? "", amount: t?.amount != null ? String(t.amount) : "",
    date: t?.date ?? today(), status: t?.status ?? "validee",
    personId: t?.person_id ?? "", notes: t?.notes ?? "",
  };
}

export function TransactionForm({ open, transaction, persons, busy = false, onSubmit, onClose }: {
  open: boolean; transaction: Transaction | null; persons: Person[];
  busy?: boolean; onSubmit: (v: TransactionFormValues) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<TransactionFormValues>(fromTx(transaction));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, busy, onClose]);

  if (!open) return null;
  function set<K extends keyof TransactionFormValues>(key: K, v: TransactionFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  const categories = values.type === "recette" ? TRANSACTION_CATEGORIES_RECETTE : TRANSACTION_CATEGORIES_DEPENSE;

  function submit() {
    setError(null);
    if (!values.label.trim()) { setError("Le libellé est obligatoire."); return; }
    const n = Number(values.amount.trim().replace(",", "."));
    if (!values.amount.trim() || Number.isNaN(n) || n <= 0) { setError("Le montant doit être un nombre positif."); return; }
    if (!values.date) { setError("La date est obligatoire."); return; }
    onSubmit({ ...values, label: values.label.trim() });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true"
        aria-label={transaction ? "Modifier la transaction" : "Nouvelle transaction"}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {transaction ? "Modifier la transaction" : "Nouvelle transaction"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Type</label>
              <select className="mc-input" value={values.type} onChange={(e) => { set("type", e.target.value as Transaction["type"]); set("category", "autre"); }}>
                <option value="recette">Recette</option>
                <option value="depense">Dépense</option>
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Catégorie</label>
              <select className="mc-input" value={values.category} onChange={(e) => set("category", e.target.value)}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Libellé *</label>
            <input className="mc-input" value={values.label} autoFocus onChange={(e) => set("label", e.target.value)} placeholder="Location salle, Loyer juin, Subvention…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Montant (€) *</label>
              <input className="mc-input" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="ex. 220" />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Date *</label>
              <input className="mc-input" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select className="mc-input" value={values.status} onChange={(e) => set("status", e.target.value as Transaction["status"])}>
                {TRANSACTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Personne liée</label>
              <select className="mc-input" value={values.personId} onChange={(e) => set("personId", e.target.value)}>
                <option value="">— Aucune —</option>
                {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Notes</label>
            <textarea className="mc-textarea" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Référence, numéro de facture…" />
          </div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>
            {busy ? "…" : transaction ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
