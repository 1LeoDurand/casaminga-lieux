import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ResidencesTabs } from "@/components/mc/residences-tabs";
import {
  getOrganizationBySlug,
  getResidencesForOrg,
  getSpacesForOrg,
  getPersonsForOrg,
  getArtistsForOrg,
} from "@/lib/data";

export default async function ResidencesPage({
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

  const initialTab = vue === "artistes" ? "artistes" : "sejours";

  const [residences, spaces, persons, artists] = await Promise.all([
    getResidencesForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getArtistsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Gestion du lieu"
        title="Résidences"
        sub="Séjours artistiques et annuaire des artistes accueillis — de la candidature à la clôture."
      />
      <ResidencesTabs
        residences={residences}
        spaces={spaces}
        persons={persons}
        artists={artists}
        orgSlug={organization.slug}
        orgId={organization.id}
        initialTab={initialTab as "sejours" | "artistes"}
      />
    </div>
  );
}
