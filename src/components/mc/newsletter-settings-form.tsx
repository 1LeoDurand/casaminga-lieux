"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { saveSettingsAction } from "@/app/(admin)/dashboard/[org]/communication/newsletter-actions";
import { JOURS_SEMAINE, type NewsletterSettings, type NewsletterMode } from "@/lib/newsletter/types";

const inp = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const lbl = "mb-1.5 block text-[12px] font-semibold text-ink";

interface GroupLite { id: string; name: string; memberCount: number }

export function NewsletterSettingsForm({
  settings,
  orgId,
  orgSlug,
  groups,
}: {
  settings: NewsletterSettings | null;
  orgId: string;
  orgSlug: string;
  groups: GroupLite[];
}) {
  const [actif, setActif] = useState(settings?.actif ?? false);
  const [mode, setMode] = useState<NewsletterMode>(settings?.mode ?? "recurrent");
  const [freqSem, setFreqSem] = useState(settings?.frequence_semaines ?? 2);
  const [jour, setJour] = useState(settings?.jour_envoi ?? "lundi");
  const [heure, setHeure] = useState(settings?.heure_envoi ?? "09:00");
  const [segmentId, setSegmentId] = useState(settings?.segment_id ?? "");
  const [nbEvts, setNbEvts] = useState(settings?.nb_evenements_declencheur ?? 1);
  const [gardeFou, setGardeFou] = useState(settings?.garde_fou_jours ?? 7);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveSettingsAction(orgId, orgSlug, {
        actif,
        mode,
        frequence_semaines: freqSem,
        jour_envoi: jour,
        heure_envoi: heure,
        segment_id: segmentId || null,
        nb_evenements_declencheur: nbEvts,
        garde_fou_jours: gardeFou,
      } as Partial<NewsletterSettings>);
      if (res.ok) toast.success("Réglages enregistrés ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Activation */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-ink">Envoi automatique</div>
            <div className="text-[13px] text-warmgray">Activer la cadence automatique des newsletters</div>
          </div>
          <button
            type="button"
            onClick={() => setActif(!actif)}
            aria-label={actif ? "Désactiver" : "Activer"}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${actif ? "bg-coral" : "bg-warmgray/30"}`}
          >
            <span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${actif ? "left-6" : "left-1"}`} />
          </button>
        </div>
      </div>

      {/* Mode */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <label className={lbl}>Mode d'envoi</label>
        <div className="flex flex-col gap-2">
          {([
            ["recurrent",     "Récurrent",        "Toutes les X semaines, le même jour"],
            ["sur_evenement", "Sur événement",     "Dès que de nouveaux événements sont publiés"],
            ["manuel",        "Manuel uniquement", "Aucun envoi automatique"],
          ] as [NewsletterMode, string, string][]).map(([value, label, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-3.5">
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-0.5 accent-coral"
              />
              <div>
                <div className="text-[13.5px] font-semibold text-ink">{label}</div>
                <div className="text-[12px] text-warmgray">{hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Options mode récurrent */}
      {mode === "recurrent" && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 font-semibold text-ink">Cadence récurrente</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Fréquence</label>
              <select className={inp} value={freqSem} onChange={(e) => setFreqSem(Number(e.target.value))}>
                <option value={1}>Chaque semaine</option>
                <option value={2}>Toutes les 2 sem.</option>
                <option value={3}>Toutes les 3 sem.</option>
                <option value={4}>Toutes les 4 sem.</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Jour d'envoi</label>
              <select className={inp} value={jour} onChange={(e) => setJour(e.target.value)}>
                {JOURS_SEMAINE.map((j) => <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Heure</label>
              <input type="time" className={inp} value={heure} onChange={(e) => setHeure(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Options mode sur_evenement */}
      {mode === "sur_evenement" && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 font-semibold text-ink">Déclencheur événement</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Déclencher après</label>
              <select className={inp} value={nbEvts} onChange={(e) => setNbEvts(Number(e.target.value))}>
                {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} nouvel/nv événement(s) publié(s)</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Anti-spam (minimum X jours entre 2 envois)</label>
              <select className={inp} value={gardeFou} onChange={(e) => setGardeFou(Number(e.target.value))}>
                {[3, 5, 7, 14].map((n) => <option key={n} value={n}>{n} jours</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Destinataires par défaut */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <label className={lbl}>Segment par défaut</label>
        <select className={inp} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
          <option value="">Tous les membres (non désabonnés)</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount} membre(s))</option>)}
        </select>
        <p className="mt-2 text-[11.5px] text-warmgray">
          Applicable aux envois automatiques. Vous pourrez choisir un segment différent par campagne.
        </p>
      </div>

      {/* Sauvegarder */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-coral-dark disabled:opacity-50"
        >
          <Save className="size-4" /> {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
