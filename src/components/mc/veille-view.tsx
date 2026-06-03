"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal, ExternalLink, X, CalendarClock, Sparkles } from "lucide-react";
import {
  type GrantOpportunity,
  type OrgGrantProfile,
  FUNDER_TYPE_LABELS,
  GRANT_THEMES,
  FRENCH_REGIONS,
  eligibilityScore,
} from "@/lib/grants/types";
import { saveGrantProfile } from "@/app/(admin)/dashboard/[org]/subventions/veille/actions";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-coral";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";
const STRUCTURE_TYPES = ["association", "scic", "scop", "collectif", "etablissement", "autre"];

function fmtAmount(min: number | null, max: number | null) {
  const f = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (max) return `jusqu'à ${f(max)}`;
  if (min) return `dès ${f(min)}`;
  return "Montant variable";
}
function scoreColor(s: number) {
  if (s >= 75) return "bg-emerald-100 text-emerald-700";
  if (s >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export function VeilleView({
  opportunities, profile, defaultStructure, orgId, orgSlug,
}: {
  opportunities: GrantOpportunity[];
  profile: OrgGrantProfile | null;
  defaultStructure: string | null;
  orgId: string; orgSlug: string;
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [onlyEligible, setOnlyEligible] = useState(false);

  const scored = useMemo(() => {
    return opportunities
      .map((o) => ({ opp: o, score: eligibilityScore(o, profile) }))
      .sort((a, b) => b.score - a.score);
  }, [opportunities, profile]);

  const visible = onlyEligible ? scored.filter((s) => s.score >= 50) : scored;
  const hasProfile = Boolean(profile?.region || profile?.structure_type || (profile?.themes.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Bandeau profil */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4">
        <div className="text-sm">
          {hasProfile ? (
            <span className="text-warmgray">
              Profil : <b className="text-ink">{profile?.region ?? "toutes régions"}</b> ·{" "}
              <b className="text-ink">{profile?.structure_type ?? "structure non précisée"}</b>
              {profile?.themes.length ? <> · {profile.themes.length} thématique(s)</> : null}
            </span>
          ) : (
            <span className="text-coral-dark">⚠ Renseignez votre profil pour un classement par pertinence.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-warmgray">
            <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} className="size-4 accent-coral" />
            Compatibles seulement
          </label>
          <button onClick={() => setShowProfile(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40">
            <SlidersHorizontal className="size-3.5" /> Mon profil
          </button>
        </div>
      </div>

      {/* Liste */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Aucune opportunité {onlyEligible ? "compatible " : ""}pour le moment.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map(({ opp, score }) => (
            <li key={opp.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${scoreColor(score)}`}>{score}% compatible</span>
                    {opp.funder_type && <span className="rounded-full bg-peach-pale px-2.5 py-0.5 text-[11px] font-semibold text-coral-dark">{FUNDER_TYPE_LABELS[opp.funder_type]}</span>}
                    {opp.recurring && <span className="text-[11px] text-warmgray">↻ récurrent</span>}
                  </div>
                  <h3 className="mt-2 font-heading text-base font-bold text-ink">{opp.title}</h3>
                  {opp.funder && <p className="text-[13px] text-warmgray">{opp.funder}</p>}
                </div>
                <div className="text-right text-[13px]">
                  <div className="font-semibold text-ink">{fmtAmount(opp.amount_min, opp.amount_max)}</div>
                  {opp.deadline && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-warmgray">
                      <CalendarClock className="size-3.5" /> {new Date(opp.deadline).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
              </div>

              {opp.description && <p className="mt-3 text-[13.5px] leading-relaxed text-ink/80">{opp.description}</p>}

              {opp.themes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {opp.themes.map((t) => (
                    <span key={t} className={`rounded-full border px-2 py-0.5 text-[11px] ${profile?.themes.includes(t) ? "border-coral/40 bg-peach-pale text-coral-dark" : "border-border text-warmgray"}`}>{t}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  onClick={() => toast.info("Aide au dossier (checklist, pré-remplissage, rédaction IA) — bientôt disponible.")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white hover:bg-coral-dark"
                >
                  <Sparkles className="size-3.5" /> Préparer le dossier
                </button>
                {opp.application_url && (
                  <a href={opp.application_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40">
                    <ExternalLink className="size-3.5" /> Page officielle
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showProfile && (
        <ProfileModal
          profile={profile} defaultStructure={defaultStructure}
          orgId={orgId} orgSlug={orgSlug}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}

function ProfileModal({
  profile, defaultStructure, orgId, orgSlug, onClose,
}: {
  profile: OrgGrantProfile | null; defaultStructure: string | null;
  orgId: string; orgSlug: string; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [region, setRegion] = useState(profile?.region ?? "");
  const [structure, setStructure] = useState(profile?.structure_type ?? defaultStructure ?? "");
  const [themes, setThemes] = useState<string[]>(profile?.themes ?? []);
  const [budget, setBudget] = useState<string>(profile?.annual_budget != null ? String(profile.annual_budget) : "");
  const [summary, setSummary] = useState(profile?.project_summary ?? "");

  function toggleTheme(t: string) {
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }
  function submit() {
    startTransition(async () => {
      const res = await saveGrantProfile(orgId, orgSlug, {
        region: region || null,
        structure_type: structure || null,
        themes,
        annual_budget: budget ? Number(budget) : null,
        project_summary: summary.trim() || null,
      });
      if (res.ok) { toast.success("Profil enregistré ✓"); router.refresh(); onClose(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">Profil d'éligibilité</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-[13px] text-warmgray">Sert à classer les opportunités par pertinence et à pré-remplir vos dossiers.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Région</label>
            <select className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">— Toutes —</option>
              {FRENCH_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Type de structure</label>
            <select className={inputCls} value={structure} onChange={(e) => setStructure(e.target.value)}>
              <option value="">— Non précisé —</option>
              {STRUCTURE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Budget annuel (€)</label><input type="number" className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Thématiques de votre lieu</label>
            <div className="flex flex-wrap gap-1.5">
              {GRANT_THEMES.map((t) => (
                <button key={t} type="button" onClick={() => toggleTheme(t)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${themes.includes(t) ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Présentation du lieu (pour les dossiers)</label><textarea className={`${inputCls} min-h-[90px] resize-y`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Quelques lignes sur votre lieu, ses activités, son public…" /></div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
