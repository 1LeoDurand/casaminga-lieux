import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ReservationsView } from "@/components/mc/reservations-view";
import {
  getOrganizationBySlug,
  getPersonsForOrg,
  getReservationsForOrg,
  getSpacesForOrg,
} from "@/lib/data";

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [reservations, spaces, persons] = await Promise.all([
    getReservationsForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Planning du lieu"
        title="Réservations"
        sub="Les créneaux d'occupation des espaces — kanban des statuts, agenda du jour, détection des chevauchements."
      />
      <ReservationsView
        reservations={reservations}
        spaces={spaces}
        persons={persons}
        orgSlug={organization.slug}
        orgId={organization.id}
        stripeReady={!!organization.stripe_charges_enabled}
      />
    </div>
  );
}
