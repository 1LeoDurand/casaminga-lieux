import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Euro, Building2, Users, Inbox, CalendarDays, Wallet,
  CalendarCheck, RefreshCcw, Palette, AlertCircle, ListChecks,
} from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { KpiTile } from "@/components/mc/kpi-tile";
import { DashboardQuickbar } from "@/components/mc/dashboard-quickbar";
import { DashboardToday, type TodayItem } from "@/components/mc/dashboard-today";
import { OnboardingChecklist, type OnboardingStep } from "@/components/mc/onboarding-checklist";
import { WhatsNew } from "@/components/mc/whats-new";
import { ModuleSuggestion } from "@/components/mc/module-suggestion";
import {
  NextMeetingBlock, MembershipCampaignBlock, ResidencesBlock, GrantDeadlinesBlock,
} from "@/components/mc/dashboard-module-blocks";
import { StatusBadge } from "@/components/mc/status-badge";
import {
  getDocumentsForOrg,
  getEvenementsForOrg,
  getOrganizationBySlug,
  getPersonsForOrg,
  getRequestsForOrg,
  getReservationsForOrg,
  getSpacesForOrg,
  getTasksForOrg,
  getTransactionsForOrg,
  getMembershipCampaignsForOrg,
  getMembershipApplicationsForOrg,
  getResidencesForOrg,
  getMeetingsForOrg,
  getGrantsForOrg,
} from "@/lib/data";
import { getEnabledModules } from "@/lib/modules-data";
import {
  normalizeArchetype, HERO_KPIS, pickModuleBlocks, pickSuggestion, onboardingStepsFor,
  type KpiKey, type ModuleBlockKey,
} from "@/lib/dashboard-blocks";
import { isOverdue } from "@/lib/tasks-meta";
import { isToday } from "@/lib/reservations-meta";
import { isFuture, isThisWeek } from "@/lib/events-meta";
import { formatAmount } from "@/lib/finances-meta";
import type { MembershipApplication, Residence, Meeting, Grant } from "@/lib/types";

const OPEN_STATUSES_EXCLUDED = ["validee", "refusee", "archivee"];

function weekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
}

export default async function DashboardOverview({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  // Archétype + modules activés → pilotent la composition du dashboard
  const archetype = normalizeArchetype(organization.org_type ?? organization.demo_archetype);
  const enabledModules = await getEnabledModules(organization.id);
  const has = (k: string) => enabledModules.has(k);

  const [requests, persons, spaces, reservations, evenements, transactions, tasks, documents, campaigns] = await Promise.all([
    getRequestsForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getReservationsForOrg(organization.id),
    getEvenementsForOrg(organization.id),
    getTransactionsForOrg(organization.id),
    getTasksForOrg(organization.id),
    getDocumentsForOrg(organization.id),
    getMembershipCampaignsForOrg(organization.id),
  ]);

  // Chargements conditionnels — seulement si le module est activé
  const [applications, residences, meetings, grants]: [MembershipApplication[], Residence[], Meeting[], Grant[]] = await Promise.all([
    has("adhesions") ? getMembershipApplicationsForOrg(organization.id) : Promise.resolve([]),
    has("residences") ? getResidencesForOrg(organization.id) : Promise.resolve([]),
    has("gouvernance") ? getMeetingsForOrg(organization.id) : Promise.resolve([]),
    has("subventions") ? getGrantsForOrg(organization.id) : Promise.resolve([]),
  ]);

  // ── Calculs communs ─────────────────────────────────────────────────────────
  const urgentTasks = tasks.filter(
    (t) => t.status !== "fait" && (t.priority === "haute" || isOverdue(t.due_date, t.status))
  ).length;
  const openRequests = requests.filter(
    (r) => !OPEN_STATUSES_EXCLUDED.includes(r.status)
  );
  const recent = requests.slice(0, 5);
  const activeMembers = persons.filter((p) => p.status === "actif").length;
  const eventsThisWeek = evenements.filter(
    (e) => e.status !== "annule" && isThisWeek(e.start_at)
  ).length;
  const eventsFuture = evenements.filter(
    (e) => e.status === "publie" && isFuture(e.start_at)
  ).length;
  const validTx = transactions.filter((t) => t.status !== "annulee");
  const solde = validTx.reduce((s, t) => s + (t.type === "recette" ? Number(t.amount) : -Number(t.amount)), 0);
  const availableSpaces = spaces.filter((s) => s.status === "disponible").length;
  const activeResas = reservations.filter((r) => r.status !== "annulee");
  const reservationsToday = activeResas.filter((r) => isToday(r.start_at)).length;
  const resasThisWeek = activeResas.filter((r) => isThisWeek(r.start_at)).length;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentMonth = todayIso.slice(0, 7);
  const in30d = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const in60d = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const revenusMois = validTx
    .filter((t) => t.type === "recette" && t.date?.slice(0, 7) === currentMonth)
    .reduce((s, t) => s + Number(t.amount), 0);
  const impayes = transactions.filter((t) => t.status === "en_attente" && t.type === "recette");
  const impayesTotal = impayes.reduce((s, t) => s + Number(t.amount), 0);
  const docsASigner = documents.filter((d) => d.status === "envoye").length;

  // ── Calculs adhésions (si module) ──────────────────────────────────────────
  const confirmedApps = applications.filter((a) => a.status === "confirmee");
  const adherentsAJour = confirmedApps.filter(
    (a) => !a.membership_end || a.membership_end >= todayIso
  ).length;
  const renouvellements30j = confirmedApps.filter(
    (a) => a.membership_end && a.membership_end >= todayIso && a.membership_end <= in30d
  ).length;
  const cotisationsMois = confirmedApps
    .filter((a) => a.created_at.slice(0, 7) === currentMonth)
    .reduce((s, a) => s + Number(a.amount_paid) + Number(a.donation_amount ?? 0), 0);

  // ── Calculs résidences (si module) ─────────────────────────────────────────
  const residencesEnCours = residences.filter((r) => r.status === "en_cours");
  const candidaturesResidences = residences.filter((r) => r.status === "candidature").length;
  const restitutionsAVenir = residences.filter(
    (r) => r.restitution_status === "planifiee" && r.restitution_date && r.restitution_date >= todayIso
  ).length;

  // ── Calculs gouvernance / subventions (si modules) ─────────────────────────
  const nextMeeting = meetings
    .filter((m) => m.status === "planifiee" && m.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const grantDeadlines = grants
    .filter((g) =>
      ["accordee", "en_cours"].includes(g.status) &&
      g.reporting_due_date && g.reporting_due_date <= in60d
    )
    .sort((a, b) => (a.reporting_due_date ?? "").localeCompare(b.reporting_due_date ?? ""));

  // ── Campagne publiée (bloc adhésions) ──────────────────────────────────────
  const activeCampaign = campaigns.find((c) => c.status === "publie") ?? null;
  const campaignApps = activeCampaign
    ? confirmedApps.filter((a) => a.campaign_id === activeCampaign.id)
    : [];
  const campaignCollected = campaignApps.reduce(
    (s, a) => s + Number(a.amount_paid) + Number(a.donation_amount ?? 0), 0
  );

  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now);
  const dateTag = `${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)} · semaine ${weekNumber(now)}`;

  // ── Rangée héros : catalogue de KPIs, l'archétype choisit ses 6 ─────────────
  const base = `/dashboard/${organization.slug}`;
  const KPI_CATALOG: Record<KpiKey, React.ReactNode> = {
    revenus_mois: (
      <KpiTile key="revenus_mois" icon={<Euro className="size-[18px]" />} iconBg="#ffefea" iconColor="var(--coral-dark)"
        value={formatAmount(revenusMois)} caption="Revenus du mois"
        trend={revenusMois > 0 ? "recettes confirmées" : "aucune recette ce mois"}
        trendTone={revenusMois > 0 ? "up" : undefined} href={`${base}/finances`} />
    ),
    solde: (
      <KpiTile key="solde" icon={<Wallet className="size-[18px]" />} iconBg="#fff5f0" iconColor="var(--coral-dark)"
        value={formatAmount(solde)} caption="Solde net" trend="recettes − dépenses" href={`${base}/finances`} />
    ),
    impayes: (
      <KpiTile key="impayes" icon={<AlertCircle className="size-[18px]" />} iconBg="#fdeae4" iconColor="var(--coral-dark)"
        value={formatAmount(impayesTotal)} caption="Impayés en attente"
        trend={`${impayes.length} recette${impayes.length > 1 ? "s" : ""} à encaisser`}
        trendTone={impayes.length > 0 ? "warn" : undefined} alert={impayes.length > 0} href={`${base}/finances`} />
    ),
    membres_actifs: (
      <KpiTile key="membres_actifs" icon={<Users className="size-[18px]" />} iconBg="#e5f4f7" iconColor="#0a6b78"
        value={activeMembers} caption="Membres actifs" trend="dans le CRM" href={`${base}/personnes`} />
    ),
    demandes: (
      <KpiTile key="demandes" icon={<Inbox className="size-[18px]" />} iconBg="#fff3de" iconColor="#a06800"
        value={openRequests.length} caption="Demandes en attente" trend="à traiter" trendTone="warn"
        alert={openRequests.length > 0} href={`${base}/demandes`} />
    ),
    evenements_avenir: (
      <KpiTile key="evenements_avenir" icon={<CalendarDays className="size-[18px]" />} iconBg="#f4e7ff" iconColor="#6b3aa0"
        value={eventsFuture} caption="Événements à venir" trend={`${eventsThisWeek} cette semaine`} href={`${base}/evenements`} />
    ),
    evenements_semaine: (
      <KpiTile key="evenements_semaine" icon={<CalendarDays className="size-[18px]" />} iconBg="#f4e7ff" iconColor="#6b3aa0"
        value={eventsThisWeek} caption="Événements cette semaine" trend={`${eventsFuture} à venir au total`} href={`${base}/evenements`} />
    ),
    espaces: (
      <KpiTile key="espaces" icon={<Building2 className="size-[18px]" />} iconBg="#e8f5ee" iconColor="#2f8a4c"
        value={spaces.length} caption="Espaces au catalogue"
        trend={`${availableSpaces} disponible${availableSpaces > 1 ? "s" : ""}`} href={`${base}/espaces`} />
    ),
    resas_jour: (
      <KpiTile key="resas_jour" icon={<CalendarCheck className="size-[18px]" />} iconBg="#ffefea" iconColor="var(--coral-dark)"
        value={reservationsToday} caption="Réservations du jour" trend="dans vos espaces" href={`${base}/reservations`} />
    ),
    occupation_semaine: (
      <KpiTile key="occupation_semaine" icon={<CalendarCheck className="size-[18px]" />} iconBg="#e5f4f7" iconColor="#0a6b78"
        value={resasThisWeek} caption="Résas cette semaine" trend="créneaux occupés" href={`${base}/reservations`} />
    ),
    adherents_a_jour: (
      <KpiTile key="adherents_a_jour" icon={<Users className="size-[18px]" />} iconBg="#e5f4f7" iconColor="#0a6b78"
        value={adherentsAJour} caption="Adhérents à jour" trend="cotisation valide" href={`${base}/adhesions`} />
    ),
    renouvellements_30j: (
      <KpiTile key="renouvellements_30j" icon={<RefreshCcw className="size-[18px]" />} iconBg="#fff8e0" iconColor="#a06800"
        value={renouvellements30j} caption="Renouvellements ≤ 30 j" trend="adhésions à relancer"
        trendTone={renouvellements30j > 0 ? "warn" : undefined} alert={renouvellements30j > 0} href={`${base}/adhesions`} />
    ),
    cotisations_mois: (
      <KpiTile key="cotisations_mois" icon={<Euro className="size-[18px]" />} iconBg="#e8f5ee" iconColor="#2f8a4c"
        value={formatAmount(cotisationsMois)} caption="Cotisations du mois"
        trend={cotisationsMois > 0 ? "adhésions confirmées" : "aucune ce mois"}
        trendTone={cotisationsMois > 0 ? "up" : undefined} href={`${base}/adhesions`} />
    ),
    residences_en_cours: (
      <KpiTile key="residences_en_cours" icon={<Palette className="size-[18px]" />} iconBg="#f4e7ff" iconColor="#6b3aa0"
        value={residencesEnCours.length} caption="Résidences en cours" trend="artistes accueillis" href={`${base}/residences`} />
    ),
    candidatures_residences: (
      <KpiTile key="candidatures_residences" icon={<Inbox className="size-[18px]" />} iconBg="#fff3de" iconColor="#a06800"
        value={candidaturesResidences} caption="Candidatures résidence" trend="à étudier"
        trendTone={candidaturesResidences > 0 ? "warn" : undefined} alert={candidaturesResidences > 0} href={`${base}/residences`} />
    ),
    restitutions_avenir: (
      <KpiTile key="restitutions_avenir" icon={<CalendarDays className="size-[18px]" />} iconBg="#f4e7ff" iconColor="#6b3aa0"
        value={restitutionsAVenir} caption="Restitutions à venir" trend="planifiées" href={`${base}/residences`} />
    ),
    taches_urgentes: (
      <KpiTile key="taches_urgentes" icon={<ListChecks className="size-[18px]" />} iconBg="#fff8e0" iconColor="#a06800"
        value={urgentTasks} caption="Tâches urgentes" trend="priorité haute ou en retard"
        trendTone={urgentTasks > 0 ? "warn" : undefined} alert={urgentTasks > 0} href={`${base}/taches`} />
    ),
  };
  const heroKpis = HERO_KPIS[archetype].map((k) => KPI_CATALOG[k]);

  // ── Checklist premiers pas : étapes selon l'archétype ──────────────────────
  const STEP_DONE: Record<string, boolean> = {
    members: persons.length > 0,
    campaign: campaigns.length > 0,
    event: evenements.length > 0,
    space: spaces.length > 0,
    residence_first: residences.length > 0,
    helloasso: !!organization.helloasso_connected_at,
  };
  const onboardingSteps: OnboardingStep[] = onboardingStepsFor(archetype).map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    href: `${base}/${s.segment}`,
    done: STEP_DONE[s.key] ?? false,
  }));

  // ── Tuiles « Aujourd'hui » : filtrées par modules activés ───────────────────
  const todayItems: TodayItem[] = [
    ...(has("espaces") || has("reservations") ? [
      { key: "resa", icon: "resa", iconBg: "#ffefea", iconColor: "var(--coral-dark)", num: reservationsToday, label: "Réservations du jour", segment: "reservations" } as TodayItem,
    ] : []),
    ...(has("evenements") ? [
      { key: "event", icon: "event", iconBg: "#f4e7ff", iconColor: "#6b3aa0", num: eventsThisWeek, label: "Événements cette semaine", segment: "evenements" } as TodayItem,
    ] : []),
    { key: "demande", icon: "demande", iconBg: "#fff3de", iconColor: "#a06800", num: openRequests.length, label: "Demandes à traiter", segment: "demandes" },
    ...(has("finances") || has("factures") ? [
      { key: "impayes", icon: "alert", iconBg: "#fdeae4", iconColor: "var(--coral-dark)", num: impayes.length, extra: impayesTotal > 0 ? formatAmount(impayesTotal) : undefined, label: "Impayés en attente", warn: impayes.length > 0, segment: "finances" } as TodayItem,
    ] : []),
    ...(has("documents") ? [
      { key: "sign", icon: "sign", iconBg: "#e8f1fe", iconColor: "#1d4ed8", num: docsASigner, label: "Documents à signer", warn: docsASigner > 0, segment: "documents" } as TodayItem,
    ] : []),
    ...(has("taches") ? [
      { key: "tasks", icon: "task", iconBg: "#fff8e0", iconColor: "#a06800", num: urgentTasks, label: "Tâches urgentes", warn: urgentTasks > 0, segment: "taches" } as TodayItem,
    ] : []),
  ];

  // ── Blocs modules : sélection + ordre selon l'archétype ────────────────────
  const moduleBlocks = pickModuleBlocks(archetype, enabledModules);
  const BLOCK_RENDER: Record<ModuleBlockKey, React.ReactNode> = {
    gouvernance: <NextMeetingBlock key="gouvernance" orgSlug={organization.slug} meeting={nextMeeting} />,
    adhesions: (
      <MembershipCampaignBlock key="adhesions" orgSlug={organization.slug}
        campaign={activeCampaign} confirmedCount={campaignApps.length} collected={campaignCollected} />
    ),
    residences: <ResidencesBlock key="residences" orgSlug={organization.slug} residences={residencesEnCours} />,
    subventions: <GrantDeadlinesBlock key="subventions" orgSlug={organization.slug} grants={grantDeadlines} />,
  };

  // Bloc fantôme — premier module pertinent non activé
  const suggestion = pickSuggestion(archetype, enabledModules);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag={dateTag}
        title={<>Bonjour&nbsp;👋</>}
        sub="Le cockpit du lieu : ce qui se passe aujourd'hui, ce qui demande votre attention."
        actions={<DashboardQuickbar orgSlug={organization.slug} />}
      />

      {/* Onboarding — checklist adaptée à l'archétype (auto-masquée si tout est fait) */}
      <OnboardingChecklist orgSlug={organization.slug} steps={onboardingSteps} />

      {/* Rangée héros — 6 KPIs choisis selon l'archétype du lieu */}
      <div className="mc-kpi-row">{heroKpis}</div>

      {/* Rangée 2 : Aujourd'hui + Demandes récentes (socle) */}
      <div className="mc-dash-row-2">
        <div className="mc-card px-[22px] py-5">
          <div className="mc-dash-card-head">
            <div>
              <h3 className="mc-dash-h3">Aujourd&apos;hui</h3>
              <div className="mc-dash-card-sub">Synthèse en un coup d&apos;œil</div>
            </div>
            <span className="mc-dash-pill">
              <span className="mc-dash-pulse" />
              {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <DashboardToday orgSlug={organization.slug} items={todayItems} />
        </div>

        <div className="mc-card px-[22px] py-5">
          <div className="mc-dash-card-head">
            <div>
              <h3 className="mc-dash-h3">Demandes récentes</h3>
              <div className="mc-dash-card-sub">
                Le pont entre le site public et l&apos;équipe.
              </div>
            </div>
            <Link
              href={`${base}/demandes`}
              className="mc-dash-pill prio-count hover:underline"
            >
              Tout voir →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-peach px-6 py-10 text-center text-sm text-warmgray">
              Aucune demande pour le moment.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`${base}/demandes`}
                  className="flex items-start gap-3 rounded-[14px] border border-transparent bg-gray-light px-3.5 py-3 transition-colors hover:border-peach hover:bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {r.name}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-warmgray">
                      {r.summary}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-warmgray">
                    {formatDay(r.received_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rangée 3 : blocs apportés par les modules activés */}
      {moduleBlocks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {moduleBlocks.map((k) => BLOCK_RENDER[k])}
        </div>
      )}

      {/* Bloc fantôme — suggestion contextuelle (dismissable) */}
      {suggestion && (
        <ModuleSuggestion
          orgSlug={organization.slug}
          module={suggestion.module}
          title={suggestion.title}
          description={suggestion.description}
        />
      )}

      {/* Nouveautés Casa Minga */}
      <WhatsNew orgSlug={organization.slug} />
    </div>
  );
}
