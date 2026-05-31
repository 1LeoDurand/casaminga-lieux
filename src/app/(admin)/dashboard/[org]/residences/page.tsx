import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ResidencesView } from "@/components/mc/residences-view";
import { getOrganizationBySlug, getResidencesForOrg, getSpacesForOrg, getPersonsForOrg } from "@/lib/data";

export default async function ResidencesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [residences, spaces, persons] = await Promise.all([
    getResidencesForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Accueil artistique" title="Résidences"
        sub="Candidatures, accueil et suivi des résidences artistiques — de la sélection à la clôture." />
      <ResidencesView residences={residences} spaces={spaces} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
