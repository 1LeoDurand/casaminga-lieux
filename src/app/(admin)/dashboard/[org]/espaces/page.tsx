import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { EspacesTabs } from "@/components/mc/espaces-tabs";
import {
  getOrganizationBySlug,
  getSpacesForOrg,
  getReservationsForOrg,
  getPersonsForOrg,
} from "@/lib/data";
import { getActiveEstablishments } from "@/lib/establishments";

export default async function EspacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ vue?: string }>;
}) {
  const { org } = await params;
  const { vue } = await searchParams;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const initialTab = vue === "planning" ? "planning" : "catalogue";

  const [spaces, establishments, reservations, persons] = await Promise.all([
    getSpacesForOrg(organization.id),
    getActiveEstablishments(organization.id),
    getReservationsForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Gestion du lieu"
        title="Espaces"
        sub="Le catalogue des lieux réservables et le planning des créneaux — salles, ateliers, bureaux et extérieurs."
      />
      <EspacesTabs
        spaces={spaces}
        establishments={establishments}
        reservations={reservations}
        persons={persons}
        orgSlug={organization.slug}
        orgId={organization.id}
        stripeReady={!!organization.stripe_charges_enabled}
        initialTab={initialTab as "catalogue" | "planning"}
      />
    </div>
  );
}
