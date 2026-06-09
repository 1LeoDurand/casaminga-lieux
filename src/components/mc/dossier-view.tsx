"use client";

import { useState, useEffect, useTransition } from "react";
import {
  CheckSquare, Square, ChevronRight, ExternalLink, CalendarClock,
  FileText, MapPin, Building2, Target, Euro, Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  type GrantOpportunity,
  type OrgGrantProfile,
  type GrantApplication,
  type ApplicationStatus,
  APPLICATION_STATUS_META,
  FUNDER_TYPE_LABELS,
  eligibilityScore,
} from "@/lib/grants/types";
import {
  upsertApplicationAction,
  deleteApplicationAction,
} from "@/app/(admin)/dashboard/[org]/subventions/veille/actions";

const fmtEuro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

const STATUS_ORDER: ApplicationStatus[] = ["interesse", "en_cours", "depose", "obtenu", "refuse"];

function scoreBar(score: number) {
  const color = score >= 75 ? "#2f8a4c" : score >= 50 ? "#d97706" : "#9c9590";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-cream overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-warmgray">{icon}</span>
        <h2 className="font-heading text-[15px] font-bold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function DossierView({
  opp, profile, initialApplication, orgId, orgSlug, orgName, annualRevenue,
}: {
  opp: GrantOpportunity;
  profile: OrgGrantProfile | null;
  initialApplication: GrantApplication | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  annualRevenue: number | null;
}) {
  const score = eligibilityScore(opp, profile);
  const [application, setApplication] = useState<GrantApplication | null>(initialApplication);
  const [, startTransition] = useTransition();

  // Checklist des pièces — persistée en localStorage
  const storageKey = `dossier-checklist-${opp.id}`;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(new Set(JSON.parse(raw)));
    } catch {/* ignore */}
  }, [storageKey]);

  function toggleDoc(doc: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) next.delete(doc); else next.add(doc);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {/* ignore */}
      return next;
    });
  }

  function handleStatus(newStatus: ApplicationStatus) {
    const prev = application?.status ?? null;
    startTransition(async () => {
      const res = await upsertApplicationAction(orgId, orgSlug, opp.id, newStatus, {
        opportunityTitle: opp.title,
        opportunityFunder: opp.funder,
        opportunityFunderType: opp.funder_type,
        opportunityAmountMax: opp.amount_max,
      });
      if (res.ok) {
        if (newStatus === "obtenu" && res.linked_grant_id) {
          toast.success("Félicitations ! Une convention a été créée automatiquement. 🎉");
        } else {
          toast.success(`Statut : ${APPLICATION_STATUS_META[newStatus].label}`);
        }
        setApplication((prev) => prev
          ? { ...prev, status: newStatus, linked_grant_id: res.linked_grant_id ?? prev.linked_grant_id }
          : { id: "", organization_id: orgId, opportunity_id: opp.id, status: newStatus, notes: null, amount_requested: null, applied_at: null, result_at: null, linked_grant_id: res.linked_grant_id ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
    void prev;
  }

  async function handleRemove() {
    const res = await deleteApplicationAction(orgId, orgSlug, opp.id);
    if (res.ok) { setApplication(null); toast.success("Dossier retiré du suivi"); }
    else toast.error("Erreur");
  }

  const scoreColor = score >= 75 ? "bg-emerald-100 text-emerald-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";
  const docsChecked = opp.required_documents.filter((d) => checked.has(d)).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Colonne principale */}
      <div className="flex flex-col gap-5">

        {/* Entête subvention */}
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${scoreColor}`}>{score}% compatible</span>
            {opp.funder_type && (
              <span className="rounded-full bg-peach-pale px-3 py-0.5 text-[11px] font-semibold text-coral-dark">
                {FUNDER_TYPE_LABELS[opp.funder_type]}
              </span>
            )}
            {opp.recurring && <span className="text-[11px] text-warmgray">↻ Récurrent</span>}
          </div>
          <h1 className="font-heading text-xl font-extrabold text-ink leading-tight">{opp.title}</h1>
          {opp.funder && <p className="mt-1 text-[13px] text-warmgray">{opp.funder}</p>}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-warmgray">
            {opp.amount_min || opp.amount_max ? (
              <div className="flex items-center gap-1.5">
                <Euro className="size-4" />
                <span className="font-semibold text-ink">
                  {opp.amount_min && opp.amount_max
                    ? `${fmtEuro(opp.amount_min)} – ${fmtEuro(opp.amount_max)}`
                    : opp.amount_max ? `Jusqu'à ${fmtEuro(opp.amount_max)}`
                    : `Dès ${fmtEuro(opp.amount_min!)}`}
                </span>
              </div>
            ) : null}
            {opp.deadline && (
              <div className="flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                <span>Date limite : <b className="text-ink">{fmtDate(opp.deadline)}</b></span>
              </div>
            )}
            {opp.regions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                <span>{opp.regions.join(", ")}</span>
              </div>
            )}
          </div>

          {opp.description && (
            <p className="mt-4 text-[13px] leading-relaxed text-warmgray">{opp.description}</p>
          )}

          {opp.themes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opp.themes.map((t) => (
                <span key={t} className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-medium text-ink">{t}</span>
              ))}
            </div>
          )}

          {opp.application_url && (
            <div className="mt-4">
              <a href={opp.application_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 hover:text-coral-dark">
                <ExternalLink className="size-3.5" /> Voir l&apos;appel à projets
              </a>
            </div>
          )}
        </div>

        {/* Checklist des pièces */}
        {opp.required_documents.length > 0 ? (
          <Section title={`Pièces requises (${docsChecked}/${opp.required_documents.length})`} icon={<FileText className="size-4" />}>
            {/* Barre de progression */}
            {scoreBar(Math.round((docsChecked / opp.required_documents.length) * 100))}
            <ul className="mt-4 flex flex-col gap-2">
              {opp.required_documents.map((doc) => {
                const isChecked = checked.has(doc);
                return (
                  <li key={doc}>
                    <button
                      type="button"
                      onClick={() => toggleDoc(doc)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] transition-colors ${
                        isChecked ? "border-emerald-200 bg-emerald-50/60 text-emerald-800" : "border-border bg-cream hover:border-coral/30"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Square className="size-4 shrink-0 text-warmgray" />
                      )}
                      <span className={isChecked ? "line-through opacity-60" : ""}>{doc}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-warmgray">
              <Info className="inline size-3 mr-0.5" /> Votre progression est sauvegardée localement dans ce navigateur.
            </p>
          </Section>
        ) : (
          <Section title="Pièces requises" icon={<FileText className="size-4" />}>
            <p className="text-[13px] text-warmgray">Aucune pièce spécifique renseignée pour cet appel. Consultez le site du financeur.</p>
          </Section>
        )}

        {/* Pré-remplissage profil */}
        <Section title="Éléments de votre dossier" icon={<Building2 className="size-4" />}>
          {profile ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-cream p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Nom de l&apos;organisation</div>
                  <div className="text-sm font-semibold text-ink">{orgName}</div>
                </div>
                {profile.region && (
                  <div className="rounded-xl bg-cream p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Région</div>
                    <div className="text-sm font-semibold text-ink">{profile.region}</div>
                  </div>
                )}
                {profile.structure_type && (
                  <div className="rounded-xl bg-cream p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Type de structure</div>
                    <div className="text-sm font-semibold text-ink capitalize">{profile.structure_type}</div>
                  </div>
                )}
                {profile.annual_budget && (
                  <div className="rounded-xl bg-cream p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Budget annuel (profil)</div>
                    <div className="text-sm font-semibold text-ink">{fmtEuro(profile.annual_budget)}</div>
                  </div>
                )}
                {annualRevenue !== null && annualRevenue > 0 && (
                  <div className="rounded-xl bg-cream p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Recettes annuelles (comptabilité)</div>
                    <div className="text-sm font-semibold text-ink">{fmtEuro(annualRevenue)}</div>
                  </div>
                )}
              </div>
              {profile.project_summary && (
                <div className="rounded-xl bg-cream p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Présentation du projet</div>
                  <p className="text-[13px] leading-relaxed text-ink">{profile.project_summary}</p>
                </div>
              )}
              {profile.themes.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Thématiques</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.themes.map((t) => (
                      <span key={t} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${opp.themes.includes(t) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-cream text-warmgray"}`}>
                        {opp.themes.includes(t) ? "✓ " : ""}{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-cream p-4 text-[13px] text-warmgray">
              <p>Renseignez votre profil (bouton &quot;Mon profil&quot; sur la page Veille) pour pré-remplir automatiquement vos informations.</p>
            </div>
          )}
        </Section>
      </div>

      {/* Colonne latérale — Suivi candidature */}
      <div className="flex flex-col gap-5">
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-4 font-heading text-[15px] font-bold text-ink">Suivi du dossier</h2>

          {application ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((s) => {
                  const m = APPLICATION_STATUS_META[s];
                  const isActive = application.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatus(s)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        isActive ? m.color : "border-border text-warmgray hover:border-coral/40"
                      }`}
                    >
                      {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>

              {application.linked_grant_id && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[12px] font-semibold text-emerald-800">Convention créée automatiquement</div>
                  <a
                    href={`/dashboard/${orgSlug}/subventions`}
                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
                  >
                    Voir la convention <ChevronRight className="size-3.5" />
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={handleRemove}
                className="text-[12px] text-warmgray hover:text-red-600"
              >
                Retirer du suivi
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-warmgray">Commencez à suivre ce dossier en sélectionnant un statut.</p>
              <div className="flex flex-col gap-2">
                {STATUS_ORDER.map((s) => {
                  const m = APPLICATION_STATUS_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatus(s)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-[13px] font-semibold hover:border-coral/40 transition ${m.color}`}
                    >
                      {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Compatibilité détaillée */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Target className="size-4 text-warmgray" />
            <h2 className="font-heading text-[15px] font-bold text-ink">Compatibilité</h2>
          </div>
          {scoreBar(score)}

          <div className="mt-4 space-y-2 text-[13px]">
            {/* Région */}
            <div className="flex items-center justify-between">
              <span className="text-warmgray">Région</span>
              {opp.regions.length === 0 ? (
                <span className="text-emerald-600 font-medium">✓ National</span>
              ) : profile?.region && opp.regions.includes(profile.region) ? (
                <span className="text-emerald-600 font-medium">✓ {profile.region}</span>
              ) : (
                <span className="text-warmgray">{opp.regions.slice(0, 2).join(", ")}{opp.regions.length > 2 ? "…" : ""}</span>
              )}
            </div>
            {/* Structure */}
            <div className="flex items-center justify-between">
              <span className="text-warmgray">Structure</span>
              {opp.structure_types.length === 0 ? (
                <span className="text-emerald-600 font-medium">✓ Toutes structures</span>
              ) : profile?.structure_type && opp.structure_types.includes(profile.structure_type) ? (
                <span className="text-emerald-600 font-medium">✓ {profile.structure_type}</span>
              ) : (
                <span className="text-warmgray">{opp.structure_types.join(", ")}</span>
              )}
            </div>
            {/* Thèmes communs */}
            {opp.themes.length > 0 && profile && (
              <div className="flex items-center justify-between">
                <span className="text-warmgray">Thèmes communs</span>
                {(() => {
                  const common = opp.themes.filter((t) => profile.themes.includes(t)).length;
                  return common > 0
                    ? <span className="text-emerald-600 font-medium">✓ {common}/{opp.themes.length}</span>
                    : <span className="text-warmgray">0/{opp.themes.length}</span>;
                })()}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
