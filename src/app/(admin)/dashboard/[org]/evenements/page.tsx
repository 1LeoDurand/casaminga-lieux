import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { EventsView } from "@/components/mc/events-view";
import { getOrganizationBySlug, getEvenementsForOrg, getSpacesForOrg } from "@/lib/data";

export default async function EvenementsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [evenements, spaces] = await Promise.all([
    getEvenementsForOrg(organization.id),
    getSpacesForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Programmation du lieu"
        title="Événements"
        sub="Ateliers, concerts, expositions, marchés — la programmation publique et interne du lieu."
      />
      <EventsView evenements={evenements} spaces={spaces} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
