"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, ArrowLeft, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { importPersonsAction, type CsvRow, type ImportResult } from "./actions";

// Mapping des noms de colonnes CSV → champs CsvRow
const COL_MAP: Record<string, keyof CsvRow> = {
  nom: "name", name: "name", prénom: "name", prenom: "name",
  email: "email", courriel: "email",
  téléphone: "phone", telephone: "phone", tel: "phone", phone: "phone",
  rôle: "role", role: "role", type: "role",
  tags: "tags", catégories: "tags", categories: "tags",
  notes: "notes", remarques: "notes",
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const mapped = headers.map((h) => COL_MAP[h] ?? null);

  return lines.slice(1).map((line) => {
    const cells = line.split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const row: Partial<Record<keyof CsvRow, string>> = {};
    mapped.forEach((key, i) => { if (key && cells[i]) row[key] = cells[i]; });
    return {
      name: row.name ?? "",
      email: row.email || null,
      phone: row.phone || null,
      role: row.role || "adherent",
      tags: row.tags ?? "",
      notes: row.notes || null,
    };
  }).filter((r) => r.name.trim());
}

const SAMPLE_CSV = "Nom,Email,Téléphone,Rôle,Tags,Notes\nMarie Dupont,marie@exemple.fr,0600000001,adherent,\"musique,atelier\",Inscription 2026\nPaul Martin,,0600000002,benevole,,";

export function ImportPersonnesClient({ orgSlug, orgId }: { orgSlug: string; orgId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCsv(text));
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleImport() {
    start(async () => {
      const res = await importPersonsAction(orgId, orgSlug, rows);
      setResult(res);
      if (res.inserted > 0) {
        setTimeout(() => router.push(`/dashboard/${orgSlug}/personnes`), 2500);
      }
    });
  }

  function downloadSample() {
    const blob = new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modele-import-membres.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button
        onClick={() => router.push(`/dashboard/${orgSlug}/personnes`)}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark"
      >
        <ArrowLeft className="size-4" /> Retour aux personnes
      </button>

      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Importer des membres (CSV)</h1>
        <p className="mt-1 text-sm text-warmgray">
          Importez vos adhérents depuis un export Yapla, Excel ou Google Sheets.
          Les doublons (même email) sont automatiquement ignorés.
        </p>
      </div>

      {/* Format attendu */}
      <div className="mc-card p-5">
        <h3 className="mb-3 font-heading text-sm font-bold text-foreground">Format attendu</h3>
        <p className="mb-2 text-xs text-warmgray">Colonnes reconnues (noms insensibles à la casse, séparateur virgule ou point-virgule) :</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {["Nom *", "Email", "Téléphone", "Rôle", "Tags", "Notes"].map((c) => (
            <span key={c} className="rounded-full border border-peach bg-peach-pale px-2.5 py-0.5 text-[11px] font-medium">{c}</span>
          ))}
        </div>
        <button onClick={downloadSample} className="flex items-center gap-1.5 text-[12px] font-semibold text-coral hover:underline">
          <Download className="size-3.5" /> Télécharger le modèle CSV
        </button>
      </div>

      {/* Upload zone */}
      <div className="mc-card p-5">
        <h3 className="mb-3 font-heading text-sm font-bold text-foreground">1. Choisir le fichier</h3>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-peach bg-peach-pale px-5 py-6 text-sm font-medium text-warmgray transition hover:border-coral hover:text-coral"
        >
          <Upload className="size-5" />
          {fileName ? fileName : "Cliquer ou déposer un fichier .csv"}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Aperçu + import */}
      {rows.length > 0 && !result && (
        <div className="mc-card p-5">
          <h3 className="mb-3 font-heading text-sm font-bold text-foreground">
            2. Aperçu — {rows.length} personne{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-peach-pale">
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">
                  {["Nom", "Email", "Téléphone", "Rôle", "Tags"].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-peach-pale/40">
                    <td className="px-3 py-1.5 font-medium">{r.name}</td>
                    <td className="px-3 py-1.5 text-warmgray">{r.email ?? "—"}</td>
                    <td className="px-3 py-1.5 text-warmgray">{r.phone ?? "—"}</td>
                    <td className="px-3 py-1.5"><span className="mc-badge capitalize">{r.role}</span></td>
                    <td className="px-3 py-1.5 text-warmgray">{r.tags || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="px-3 py-2 text-[11px] text-warmgray">… et {rows.length - 10} autres lignes.</p>
            )}
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={handleImport}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-dark disabled:opacity-50"
            >
              <Upload className="size-4" />
              {pending ? "Import en cours…" : `Importer ${rows.length} personne${rows.length > 1 ? "s" : ""}`}
            </button>
            <button onClick={() => { setRows([]); setFileName(""); }} className="text-sm text-warmgray hover:text-coral">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className={`mc-card p-5 ${result.ok || result.inserted > 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          {result.inserted > 0 && (
            <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-700">
              <CheckCircle2 className="size-5" />
              {result.inserted} personne{result.inserted > 1 ? "s" : ""} importée{result.inserted > 1 ? "s" : ""} avec succès !
            </div>
          )}
          {result.skipped > 0 && (
            <p className="text-sm text-warmgray">{result.skipped} ligne{result.skipped > 1 ? "s" : ""} ignorée{result.skipped > 1 ? "s" : ""} (doublons ou nom manquant).</p>
          )}
          {result.errors.map((e, i) => (
            <div key={i} className="mt-1 flex items-start gap-1.5 text-[12px] text-amber-800">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{e}
            </div>
          ))}
          {result.inserted > 0 && <p className="mt-2 text-[12px] text-emerald-600">Redirection vers la liste dans 2 secondes…</p>}
        </div>
      )}
    </div>
  );
}
