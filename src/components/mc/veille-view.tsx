"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal, ExternalLink, X, CalendarClock, ChevronDown, ArrowRight, FolderOpen, Search } from "lucide-react";
import {
  type GrantOpportunity,
  type OrgGrantProfile,
  type GrantApplication,
  type ApplicationStatus,
  FUNDER_TYPE_LABELS,
  FRENCH_REGIONS,
  APPLICATION_STATUS_META,
  eligibilityScore,
} from "@/lib/grants/types";
import { CATEGORY_GROUPS, splitCategory } from "@/lib/grants/taxonomy";
import {
  saveGrantProfile,
  upsertApplicationAction,
  deleteApplicationAction,
} from "@/app/(admin)/dashboard/[org]/subventions/veille/actions";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-coral";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";
const STRUCTURE_TYPES = ["association", "scic", "scop", "collectif", "etablissement", "autre"];

const STATUS_ORDER: ApplicationStatus[] = ["interesse", "en_cours", "depose", "obtenu", "refuse"];

type DeadlineFilter = "" | "soon" | "permanent";
type AidTypeFilter = "" | "grant" | "loan" | "engineering";

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

/** Une opportunité passe le filtre échéance ? */
function matchesDeadline(opp: GrantOpportunity, filter: DeadlineFilter): boolean {
  if (!filter) return true;
  if (filter === "permanent") return !opp.deadline;
  if (!opp.deadline) return false;
  const days = (new Date(opp.deadline).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 90;
}

/** Une opportunité passe le filtre nature d'aide (Layer 2) ? */
function matchesAidType(opp: GrantOpportunity, filter: AidTypeFilter): boolean {
  if (!filter) return true;
  const slugs = opp.aid_type_slugs ?? [];
  if (slugs.length === 0) return false;
  const hay = slugs.join(" ").toLowerCase();
  if (filter === "grant") return /grant|subvention/.test(hay);
  if (filter === "loan") return /loan|advance|avance/.test(hay);
  return /engineering|ingenierie|technical/.test(hay);
}

/** Sélecteur de statut candidature intégré à la carte. */
function ApplicationStatusPicker({
  current,
  onChange,
  busy,
}: {
  current: ApplicationStatus | null;
  onChange: (s: ApplicationStatus | "") => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = current ? APPLICATION_STATUS_META[current] : null;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
          meta
            ? `${meta.color}`
            : "border-border bg-white text-warmgray hover:border-coral/40"
        } disabled:opacity-50`}
      >
        {meta ? (
          <>{meta.icon} {meta.label}</>
        ) : (
          <span className="text-warmgray">Suivre ce dossier</span>
        )}
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-border bg-white shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {STATUS_ORDER.map((s) => {
            const m = APPLICATION_STATUS_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold transition hover:bg-cream ${
                  current === s ? "bg-cream" : ""
                }`}
              >
                <span>{m.icon}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${m.color}`}>{m.label}</span>
              </button>
            );
          })}
          {current && (
            <>
              <div className="mx-3 border-t border-border" />
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-[12px] text-warmgray transition hover:bg-cream"
              >
                <X className="size-3.5" /> Retirer du suivi
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Sélecteur de thématiques à 2 niveaux (thème parent repliable → catégories AT à cocher). */
function CategoryFilter({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleGroup(theme: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(theme)) next.delete(theme); else next.add(theme);
      return next;
    });
  }
  function toggleItem(label: string) {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label); else next.add(label);
    onChange(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-[#FAFAF7] px-3 py-2.5 text-sm text-ink outline-none focus:border-coral"
      >
        {selected.size === 0 ? "Toutes les thématiques" : `${selected.size} thématique${selected.size > 1 ? "s" : ""}`}
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1.5 max-h-[360px] w-[360px] max-w-[90vw] overflow-y-auto rounded-xl border border-border bg-white shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {CATEGORY_GROUPS.map((group) => {
            const isExpanded = expanded.has(group.theme);
            const selectedInGroup = group.items.filter((it) => selected.has(it.label)).length;
            return (
              <div key={group.theme} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.theme)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-ink hover:bg-cream"
                >
                  <span>{group.theme}{selectedInGroup > 0 ? ` (${selectedInGroup})` : ""}</span>
                  <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-0.5 px-3.5 pb-2.5">
                    {group.items.map((item) => (
                      <label
                        key={item.label}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px] text-warmgray hover:bg-cream"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(item.label)}
                          onChange={() => toggleItem(item.label)}
                          className="size-3.5 accent-coral"
                        />
                        {item.leaf}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {selected.size > 0 && (
            <div className="border-t border-border px-3.5 py-2">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[12px] font-semibold text-coral-dark hover:underline"
              >
                Tout effacer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VeilleView({
  opportunities, profile, applications: initialApplications, defaultStructure, orgId, orgSlug, orgRegions,
}: {
  opportunities: GrantOpportunity[];
  profile: OrgGrantProfile | null;
  applications: Map<string, GrantApplication>;
  defaultStructure: string | null;
  orgId: string; orgSlug: string;
  orgRegions: string[];
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Filtres utilisateur (catalogue volumineux → indispensables)
  const PAGE = 40;
  const [query, setQuery] = useState("");
  const [funderFilter, setFunderFilter] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("");
  const [aidTypeFilter, setAidTypeFilter] = useState<AidTypeFilter>("");
  const [limit, setLimit] = useState(PAGE);
  // Repart du début quand un filtre change — reset pendant le rendu (pattern React
  // recommandé, sans effet) via une clé dérivée des filtres actifs.
  const filterKey = `${query}|${funderFilter}|${[...selectedCats].sort().join(",")}|${deadlineFilter}|${aidTypeFilter}|${onlyEligible}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLimit(PAGE);
  }

  // Optimistic local state: opportunity_id → { status, linked_grant_id }
  type LocalApp = { status: ApplicationStatus | null; linked_grant_id?: string | null };
  const [localApps, setLocalApps] = useState<Map<string, LocalApp>>(new Map());

  const scored = useMemo(() => {
    return opportunities
      .map((o) => ({ opp: o, score: eligibilityScore(o, profile, orgRegions) }))
      .sort((a, b) => b.score - a.score);
  }, [opportunities, profile, orgRegions]);

  // Facette « nature d'aide » : affichée seulement si le catalogue a des aid_type_slugs (Layer 2).
  const hasAidTypes = useMemo(
    () => opportunities.some((o) => (o.aid_type_slugs?.length ?? 0) > 0),
    [opportunities]
  );

  const hasActiveFilters = Boolean(
    query || funderFilter || selectedCats.size > 0 || deadlineFilter || aidTypeFilter || onlyEligible
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored.filter(({ opp, score }) => {
      if (onlyEligible && score < 50) return false;
      if (funderFilter && opp.funder_type !== funderFilter) return false;
      if (selectedCats.size > 0 && !opp.themes.some((t) => selectedCats.has(t))) return false;
      if (!matchesDeadline(opp, deadlineFilter)) return false;
      if (hasAidTypes && !matchesAidType(opp, aidTypeFilter)) return false;
      if (q) {
        const hay = `${opp.title} ${opp.funder ?? ""} ${opp.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scored, onlyEligible, funderFilter, selectedCats, deadlineFilter, aidTypeFilter, hasAidTypes, query]);

  const shown = filtered.slice(0, limit);
  const hasProfile = Boolean(profile?.region || profile?.structure_type || (profile?.themes.length ?? 0) > 0);

  function getApp(oppId: string): { status: ApplicationStatus | null; linked_grant_id: string | null } {
    if (localApps.has(oppId)) {
      const l = localApps.get(oppId)!;
      return { status: l.status, linked_grant_id: l.linked_grant_id ?? null };
    }
    const app = initialApplications.get(oppId);
    return { status: app?.status ?? null, linked_grant_id: app?.linked_grant_id ?? null };
  }

  function handleStatusChange(opp: GrantOpportunity, statusOrEmpty: ApplicationStatus | "") {
    const newStatus = statusOrEmpty === "" ? null : statusOrEmpty;

    // Optimistic update
    setLocalApps((prev) => new Map(prev).set(opp.id, {
      status: newStatus,
      linked_grant_id: getApp(opp.id).linked_grant_id,
    }));
    setBusyId(opp.id);

    startTransition(async () => {
      if (newStatus === null) {
        // Delete
        const res = await deleteApplicationAction(orgId, orgSlug, opp.id);
        if (res.ok) {
          toast.success("Dossier retiré du suivi.");
          setLocalApps((prev) => { const m = new Map(prev); m.delete(opp.id); return m; });
        } else {
          toast.error(res.error ?? "Erreur lors de la suppression.");
          setLocalApps((prev) => { const m = new Map(prev); m.delete(opp.id); return m; });
        }
        setBusyId(null);
        return;
      }

      const res = await upsertApplicationAction(orgId, orgSlug, opp.id, newStatus, {
        opportunityTitle: opp.title,
        opportunityFunder: opp.funder,
        opportunityFunderType: opp.funder_type ?? undefined,
        opportunityAmountMax: opp.amount_max,
      });

      if (res.ok) {
        // Update local with potential linked_grant_id from response
        setLocalApps((prev) => new Map(prev).set(opp.id, {
          status: newStatus,
          linked_grant_id: res.linked_grant_id ?? getApp(opp.id).linked_grant_id,
        }));
        if (newStatus === "obtenu" && res.linked_grant_id) {
          toast.success("Félicitations ! Une convention de subvention a été créée automatiquement. 🎉");
        } else {
          toast.success(`Statut mis à jour : ${APPLICATION_STATUS_META[newStatus].label}`);
        }
      } else {
        toast.error(res.error ?? "Erreur");
        setLocalApps((prev) => { const m = new Map(prev); m.delete(opp.id); return m; });
      }
      setBusyId(null);
    });
  }

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
            <span className="text-warmgray">Profil d&apos;éligibilité non renseigné.</span>
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

      {/* Encart profil vide — sans profil, le score de pertinence est neutre */}
      {!hasProfile && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-coral/30 bg-peach-pale px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-heading text-[15px] font-bold text-ink">
              Complétez le profil de votre lieu
            </div>
            <p className="mt-0.5 text-[13px] text-warmgray">
              Région, type de structure, thématiques : 2 minutes pour classer ces{" "}
              {opportunities.length.toLocaleString("fr-FR")} aides par pertinence pour vous.
            </p>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="shrink-0 rounded-full bg-coral px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-coral-dark"
          >
            Compléter mon profil
          </button>
        </div>
      )}

      {/* Barre de filtres */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warmgray" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une aide, un financeur, un mot-clé…"
            className="w-full rounded-xl border border-border bg-[#FAFAF7] py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-coral"
          />
        </div>
        <select value={funderFilter} onChange={(e) => setFunderFilter(e.target.value)} className="rounded-xl border border-border bg-[#FAFAF7] px-3 py-2.5 text-sm text-ink outline-none focus:border-coral">
          <option value="">Tous les financeurs</option>
          {Object.entries(FUNDER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <CategoryFilter selected={selectedCats} onChange={setSelectedCats} />
        <select
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
          className="rounded-xl border border-border bg-[#FAFAF7] px-3 py-2.5 text-sm text-ink outline-none focus:border-coral"
        >
          <option value="">Toutes les échéances</option>
          <option value="soon">Échéance &lt; 90 jours</option>
          <option value="permanent">Sans échéance / permanentes</option>
        </select>
        {hasAidTypes && (
          <select
            value={aidTypeFilter}
            onChange={(e) => setAidTypeFilter(e.target.value as AidTypeFilter)}
            className="rounded-xl border border-border bg-[#FAFAF7] px-3 py-2.5 text-sm text-ink outline-none focus:border-coral"
          >
            <option value="">Toutes les aides</option>
            <option value="grant">Subventions</option>
            <option value="loan">Prêts / avances</option>
            <option value="engineering">Ingénierie / accompagnement</option>
          </select>
        )}
      </div>

      {/* Compteur */}
      <div className="px-1 text-[12.5px] text-warmgray">
        {filtered.length} aide{filtered.length > 1 ? "s" : ""}
        {filtered.length !== opportunities.length ? ` sur ${opportunities.length}` : ""}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setQuery("");
              setFunderFilter("");
              setSelectedCats(new Set());
              setDeadlineFilter("");
              setAidTypeFilter("");
              setOnlyEligible(false);
            }}
            className="ml-2 font-semibold text-coral-dark hover:underline"
          >
            réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Aucune opportunité {hasActiveFilters ? "ne correspond à votre recherche" : "pour le moment"}.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map(({ opp, score }) => {
            const { status: currentStatus, linked_grant_id } = getApp(opp.id);
            const isBusy = busyId === opp.id;
            return (
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
                    {opp.themes.map((t) => {
                      const { leaf } = splitCategory(t);
                      return (
                        <span
                          key={t}
                          title={t}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${profile?.themes.includes(t) ? "border-coral/40 bg-peach-pale text-coral-dark" : "border-border text-warmgray"}`}
                        >
                          {leaf}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {/* Statut candidature */}
                  <ApplicationStatusPicker
                    current={currentStatus}
                    onChange={(s) => handleStatusChange(opp, s)}
                    busy={isBusy}
                  />

                  {/* Lien vers la convention si "obtenu" */}
                  {linked_grant_id && (
                    <a
                      href={`/dashboard/${orgSlug}/subventions`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <ArrowRight className="size-3.5" /> Voir la convention
                    </a>
                  )}

                  {/* Lien vers le dossier guidé */}
                  <Link
                    href={`/dashboard/${orgSlug}/subventions/veille/${opp.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40"
                  >
                    <FolderOpen className="size-3.5" /> Préparer le dossier
                  </Link>

                  {opp.application_url && (
                    <a href={opp.application_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40">
                      <ExternalLink className="size-3.5" /> Page officielle
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {filtered.length > shown.length && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mx-auto rounded-full border border-border bg-white px-6 py-2.5 text-[13px] font-semibold text-ink hover:border-coral/40"
        >
          Afficher plus ({filtered.length - shown.length} restantes)
        </button>
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(
      CATEGORY_GROUPS
        .filter((g) => g.items.some((it) => (profile?.themes ?? []).includes(it.label)))
        .map((g) => g.theme)
    )
  );

  function toggleTheme(t: string) {
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }
  function toggleGroup(theme: string) {
    setExpandedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(theme)) next.delete(theme); else next.add(theme);
      return next;
    });
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
          <h3 className="font-heading text-lg font-bold text-ink">Profil d&apos;éligibilité</h3>
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
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border">
              {CATEGORY_GROUPS.map((group) => {
                const isExpanded = expandedGroups.has(group.theme);
                const selectedCount = group.items.filter((it) => themes.includes(it.label)).length;
                return (
                  <div key={group.theme} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.theme)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-cream"
                    >
                      <span>{group.theme}{selectedCount > 0 ? ` (${selectedCount})` : ""}</span>
                      <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                        {group.items.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => toggleTheme(item.label)}
                            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${themes.includes(item.label) ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}
                          >
                            {item.leaf}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
