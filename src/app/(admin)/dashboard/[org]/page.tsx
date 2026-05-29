import { Inbox, Users, CalendarDays, DoorOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/mc/kpi-card";
import { StatusBadge } from "@/components/mc/status-badge";
import { getOrganizationBySlug, getRequestsForOrg } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function DashboardOverview({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const requests = await getRequestsForOrg(organization.id);
  const openRequests = requests.filter(
    (r) => !["validee", "refusee", "archivee"].includes(r.status)
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
          Vue d&apos;ensemble
        </span>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
          Bonjour 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voici l&apos;activité du {organization.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Demandes ouvertes"
          value={openRequests.length}
          hint="à traiter"
          accent="coral"
          icon={<Inbox className="size-5" />}
        />
        <KpiCard
          label="Personnes"
          value={48}
          hint="membres & contacts"
          accent="turquoise"
          icon={<Users className="size-5" />}
        />
        <KpiCard
          label="Événements à venir"
          value={6}
          hint="30 prochains jours"
          accent="golden"
          icon={<CalendarDays className="size-5" />}
        />
        <KpiCard
          label="Espaces"
          value={9}
          hint="ateliers, salles, bureaux"
          accent="mint"
          icon={<DoorOpen className="size-5" />}
        />
      </div>

      <Card className="gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-bold">Demandes récentes</h2>
            <p className="text-sm text-muted-foreground">
              Le pont entre le site public et l&apos;équipe.
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {requests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucune demande pour le moment.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-peach-pale/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {r.summary}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {r.received_at}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
