"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, RefreshCw, Save, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { periodLabel, formatDateFr, formatEuros, sectionLabel } from "@/lib/coordination/meta";
import {
  updateCoordinationNote,
  refreshCoordinationSnapshot,
} from "@/app/(admin)/dashboard/[org]/impact/notes/actions";
import type { CoordinationNote, NoteSections, SectionKey } from "@/lib/coordination/types";

const ORDER: SectionKey[] = ["finances", "events", "residences", "impact"];

export function CoordinationNoteEditor({ note, orgSlug }: { note: CoordinationNote; orgSlug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [intro, setIntro] = useState(note.intro ?? "");
  const [conclusion, setConclusion] = useState(note.conclusion ?? "");
  const [sections, setSections] = useState<NoteSections>(note.sections);
  const [status, setStatus] = useState(note.status);
  const [saving, startSave] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const snap = note.snapshot ?? {};

  function setCommentary(k: SectionKey, v: string) {
    setSections((s) => ({ ...s, [k]: { ...s[k], commentary: v } }));
  }

  function save(nextStatus?: typeof status) {
    startSave(async () => {
      const res = await updateCoordinationNote(orgSlug, note.id, {
        title, intro, conclusion, sections, status: nextStatus ?? status,
      });
      if (res.ok) {
        if (nextStatus) setStatus(nextStatus);
        toast.success("Note enregistrée");
      } else toast.error(res.error ?? "Enregistrement impossible.");
    });
  }

  function refresh() {
    startRefresh(async () => {
      const res = await refreshCoordinationSnapshot(orgSlug, note.id);
      if (res.ok) { toast.success("Données actualisées"); router.refresh(); }
      else toast.error(res.error ?? "Actualisation impossible.");
    });
  }

  const enabled = ORDER.filter((k) => sections[k]?.enabled);

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête / actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/dashboard/${orgSlug}/impact`} className="inline-flex items-center gap-1.5 text-sm font-medium text-warmgray hover:text-foreground">
          <ArrowLeft className="size-4" /> Retour à l'Impact
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualiser les données
          </button>
          <a href={`/dashboard/${orgSlug}/impact/notes/${note.id}/docx`} className="mc-btn mc-btn-outline mc-btn-sm">
            <FileDown className="size-3.5" /> Exporter en Word
          </a>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => save()} disabled={saving}>
            <Save className="size-3.5" /> {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Titre + période */}
      <div className="mc-card p-5">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
          <FileText className="size-3.5" /> Note de coordination
          <span className={`mc-badge ${status === "finalisee" ? "mc-badge-green" : "mc-badge-gray"}`}>{status === "finalisee" ? "Finalisée" : "Brouillon"}</span>
        </div>
        <input
          className="mc-input !text-xl !font-bold !font-heading"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la note"
        />
        <p className="mt-2 text-sm text-warmgray">
          Période : <strong className="text-foreground">{periodLabel(note.period_type, note.period_start, note.period_end)}</strong>
          {" · "}{formatDateFr(note.period_start)} – {formatDateFr(note.period_end)}
        </p>
      </div>

      {/* Introduction */}
      <div className="mc-card p-5">
        <label className="mc-form-label">Introduction</label>
        <textarea className="mc-input min-h-[90px]" value={intro} onChange={(e) => setIntro(e.target.value)}
          placeholder="Contexte général, faits marquants de la période…" />
      </div>

      {/* Blocs */}
      {enabled.map((k) => (
        <div key={k} className="mc-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-heading text-base font-bold text-foreground">
            <span className="inline-block size-2 rounded-full bg-coral" /> {sectionLabel(k)}
          </h3>
          <SectionPreview k={k} snap={snap} />
          <label className="mc-form-label mt-4">Commentaire du coordinateur</label>
          <textarea className="mc-input min-h-[80px]" value={sections[k]?.commentary ?? ""}
            onChange={(e) => setCommentary(k, e.target.value)}
            placeholder="Analyse, points d'attention, décisions…" />
        </div>
      ))}

      {/* Conclusion */}
      <div className="mc-card p-5">
        <label className="mc-form-label">Conclusion</label>
        <textarea className="mc-input min-h-[90px]" value={conclusion} onChange={(e) => setConclusion(e.target.value)}
          placeholder="Perspectives, prochaines étapes…" />
      </div>

      {/* Pied : finalisation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-warmgray">
          {status === "finalisee"
            ? "Note finalisée — vous pouvez toujours la rouvrir et la modifier."
            : "Brouillon — enregistrez régulièrement, finalisez quand la note est prête."}
        </p>
        <div className="flex gap-2">
          {status === "finalisee" ? (
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => save("brouillon")} disabled={saving}>
              Repasser en brouillon
            </button>
          ) : (
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => save("finalisee")} disabled={saving}>
              <CheckCircle2 className="size-3.5" /> Finaliser la note
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Aperçu des données figées par bloc ────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-sm text-warmgray">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SectionPreview({ k, snap }: { k: SectionKey; snap: CoordinationNote["snapshot"] }) {
  if (k === "finances" && snap.finances) {
    const f = snap.finances;
    return (
      <div className="rounded-lg bg-cream/60 p-3">
        <Row label="Recettes" value={formatEuros(f.recettes)} />
        <Row label="Dépenses" value={formatEuros(f.depenses)} />
        <Row label="Solde net" value={formatEuros(f.solde)} />
        <Row label="Écritures sur la période" value={String(f.count)} />
      </div>
    );
  }
  if (k === "events" && snap.events) {
    const e = snap.events;
    return (
      <div className="rounded-lg bg-cream/60 p-3 text-sm text-foreground">
        <Row label="Événements" value={String(e.events.length)} />
        <Row label="Réservations d'espaces" value={String(e.reservations.length)} />
        {e.events.slice(0, 5).map((ev, i) => (
          <div key={i} className="mt-1 text-[13px] text-warmgray">• {formatDateFr(ev.date)} — {ev.title}</div>
        ))}
      </div>
    );
  }
  if (k === "residences" && snap.residences) {
    const r = snap.residences;
    return (
      <div className="rounded-lg bg-cream/60 p-3">
        <Row label="Résidences listées" value={String(r.residences.length)} />
        <Row label="Nouvelles adhésions" value={`${r.adhesions.count} · ${formatEuros(r.adhesions.total)}`} />
        {r.residences.slice(0, 5).map((res, i) => (
          <div key={i} className="mt-1 text-[13px] text-warmgray">• {res.title} — {res.discipline} ({res.status})</div>
        ))}
      </div>
    );
  }
  if (k === "impact" && snap.impact) {
    const im = snap.impact;
    return (
      <div className="rounded-lg bg-cream/60 p-3">
        <Row label="Indicateurs d'impact" value={String(im.indicators.length)} />
        <Row label="Dons confirmés" value={`${im.donations.count} · ${formatEuros(im.donations.total)}`} />
        <Row label="Subventions en cours" value={String(im.grants.length)} />
      </div>
    );
  }
  return <p className="text-sm italic text-warmgray">Aucune donnée figée pour ce bloc.</p>;
}
