import Link from "next/link";
import { notFound } from "next/navigation";
import { Euro, Building2, Users, Inbox, CalendarDays, Wallet } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { KpiTile } from "@/components/mc/kpi-tile";
import { DashboardQuickbar } from "@/components/mc/dashboard-quickbar";
import { DashboardToday, type TodayItem } from "@/components/mc/dashboard-today";
import { StatusBadge } from "@/components/mc/status-badge";
import {
  getEvenementsForOrg,
  getOrganizationBySlug,
  getPersonsForOrg,
  getRequestsForOrg,
  getReservationsForOrg,
  getSpacesForOrg,
  getTransactionsForOrg,
} from "@/lib/data";
import { isToday } from "@/lib/reservations-meta";
import { isFuture, isThisWeek } from "@/lib/events-meta";
import { formatAmount } from "@/lib/finances-meta";

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

  const [requests, persons, spaces, reservations, evenements, transactions] = await Promise.all([
    getRequestsForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getReservationsForOrg(organization.id),
    getEvenementsForOrg(organization.id),
    getTransactionsForOrg(organization.id),
  ]);
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
  const reservationsToday = reservations.filter(
    (r) => r.status !== "annulee" && isToday(r.start_at)
  ).length;

  const now = new Date();
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const dateTag = `${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)} · semaine ${weekNumber(now)}`;

  const todayItems: TodayItem[] = [
    { key: "resa", icon: "resa", iconBg: "#ffefea", iconColor: "var(--coral-dark)", num: reservationsToday, label: "Réservations du jour", segment: "reservations" },
    { key: "event", icon: "event", iconBg: "#f4e7ff", iconColor: "#6b3aa0", num: eventsThisWeek, label: "Événements cette semaine", segment: "evenements" },
    { key: "demande", icon: "demande", iconBg: "#fff3de", iconColor: "#a06800", num: openRequests.length, label: "Demandes à traiter", segment: "demandes" },
    { key: "impayes", icon: "alert", iconBg: "#fdeae4", iconColor: "var(--coral-dark)", num: 2, extra: "480 €", label: "Impayés en attente", warn: true, segment: undefined },
    { key: "sign", icon: "sign", iconBg: "#e8f1fe", iconColor: "#1d4ed8", num: 3, label: "Documents à signer", segment: undefined },
    { key: "tasks", icon: "task", iconBg: "#fff8e0", iconColor: "#a06800", num: 2, label: "Tâches urgentes", warn: true, segment: undefined },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag={dateTag}
        title={<>Bonjour&nbsp;👋</>}
        sub="Le cockpit du lieu : ce qui se passe aujourd'hui, ce qui demande votre attention."
        actions={<DashboardQuickbar orgSlug={organization.slug} />}
      />

      {/* Rangée KPI (illustrative en mode démo, sauf « Demandes ») */}
      <div className="mc-kpi-row">
        <KpiTile
          icon={<Euro className="size-[18px]" />}
          iconBg="#ffefea"
          iconColor="var(--coral-dark)"
          value="3 840 €"
          caption="Revenus du mois"
          trend="↑ +8 % vs mois dernier"
          trendTone="up"
        />
        <KpiTile
          icon={<Building2 className="size-[18px]" />}
          iconBg="#e8f5ee"
          iconColor="#2f8a4c"
          value={spaces.length}
          caption="Espaces au catalogue"
          trend={`${availableSpaces} disponible${availableSpaces > 1 ? "s" : ""}`}
          href={`/dashboard/${organization.slug}/espaces`}
        />
        <KpiTile
          icon={<Users className="size-[18px]" />}
          iconBg="#e5f4f7"
          iconColor="#0a6b78"
          value={activeMembers}
          caption="Membres actifs"
          trend="dans le CRM"
        />
        <KpiTile
          icon={<Inbox className="size-[18px]" />}
          iconBg="#fff3de"
          iconColor="#a06800"
          value={openRequests.length}
          caption="Demandes en attente"
          trend="à traiter"
          trendTone="warn"
          alert={openRequests.length > 0}
          href={`/dashboard/${organization.slug}/demandes`}
        />
        <KpiTile
          icon={<CalendarDays className="size-[18px]" />}
          iconBg="#f4e7ff"
          iconColor="#6b3aa0"
          value={eventsFuture}
          caption="Événements à venir"
          trend={`${eventsThisWeek} cette semaine`}
          href={`/dashboard/${organization.slug}/evenements`}
        />
        <KpiTile
          icon={<Wallet className="size-[18px]" />}
          iconBg="#fff5f0"
          iconColor="var(--coral-dark)"
          value={formatAmount(solde)}
          caption="Solde net"
          trend="recettes − dépenses"
          href={`/dashboard/${organization.slug}/finances`}
        />
      </div>

      {/* Rangée 2 : Aujourd'hui + Demandes récentes */}
      <div className="mc-dash-row-2">
        <div className="mc-card px-[22px] py-5">
          <div className="mc-dash-card-head">
            <div>
              <h3 className="mc-dash-h3">Aujourd&apos;hui</h3>
              <div className="mc-dash-card-sub">Synthèse en un coup d&apos;œil</div>
            </div>
            <span className="mc-dash-pill">
              <span className="mc-dash-pulse" />
              Mis à jour à l&apos;instant
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
              href={`/dashboard/${organization.slug}/demandes`}
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
                  href={`/dashboard/${organization.slug}/demandes`}
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
    </div>
  );
}
