"use client";
import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@/lib/documents-meta";
import { createClient } from "@/lib/supabase/client";
import type { Document, Person } from "@/lib/types";

export interface DocumentFormValues {
  title: string; type: string; status: Document["status"];
  personId: string; fileUrl: string; fileName: string; notes: string;
}

function fromDoc(d: Document | null): DocumentFormValues {
  return {
    title: d?.title ?? "", type: d?.type ?? "autre", status: d?.status ?? "brouillon",
    personId: d?.person_id ?? "", fileUrl: d?.file_url ?? "",
    fileName: d?.file_name ?? "", notes: d?.notes ?? "",
  };
}

export function DocumentForm({ open, document, persons, orgId, busy = false, onSubmit, onClose }: {
  open: boolean; document: Document | null; persons: Person[];
  orgId: string;
  busy?: boolean; onSubmit: (v: DocumentFormValues) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<DocumentFormValues>(fromDoc(document));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !uploading) onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, busy, uploading, onClose]);

  useEffect(() => {
    if (open) setValues(fromDoc(document));
  }, [open, document]);

  if (!open) return null;

  function set<K extends keyof DocumentFormValues>(key: K, v: DocumentFormValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `org/${orgId}/documents/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("public-assets")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      set("fileUrl", data.publicUrl);
      set("fileName", file.name);
      if (!values.title) set("title", file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setError(`Échec de l'upload : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    setError(null);
    if (!values.title.trim()) { setError("Le titre est obligatoire."); return; }
    onSubmit({ ...values, title: values.title.trim() });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && !uploading && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true"
        aria-label={document ? "Modifier le document" : "Nouveau document"}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">
            {document ? "Modifier le document" : "Nouveau document"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group">
            <label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={values.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Convention résidence, Devis location…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Type</label>
              <select className="mc-input" value={values.type} onChange={(e) => set("type", e.target.value)}>
                {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Statut</label>
              <select className="mc-input" value={values.status} onChange={(e) => set("status", e.target.value as Document["status"])}>
                {DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Personne liée</label>
            <select className="mc-input" value={values.personId} onChange={(e) => set("personId", e.target.value)}>
              <option value="">— Aucune —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Upload fichier */}
          <div className="mc-form-group">
            <label className="mc-form-label">Fichier</label>
            <div
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-peach-pale px-4 py-3 transition-colors hover:border-coral/60"
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? <Loader2 className="size-5 animate-spin text-coral" />
                : <Upload className="size-5 text-warmgray" />}
              <span className="text-[13px] text-warmgray">
                {uploading ? "Upload en cours…" : values.fileName || "Cliquer pour choisir un fichier (PDF, image…)"}
              </span>
              {values.fileName && !uploading && (
                <span className="ml-auto text-[11px] font-semibold text-emerald-700">✓ Chargé</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </div>

          {/* URL manuelle (fallback) */}
          <details>
            <summary className="cursor-pointer text-[12px] font-medium text-warmgray hover:text-ink">
              Ou coller une URL (Google Drive, etc.)
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <input className="mc-input" value={values.fileUrl} onChange={(e) => set("fileUrl", e.target.value)} placeholder="https://drive.google.com/…" />
              <input className="mc-input" value={values.fileName} onChange={(e) => set("fileName", e.target.value)} placeholder="nom-du-fichier.pdf" />
            </div>
          </details>

          <div className="mc-form-group">
            <label className="mc-form-label">Notes</label>
            <textarea className="mc-textarea" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observations, conditions, échéances…" />
          </div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy || uploading}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy || uploading}>
            {busy ? "…" : document ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
