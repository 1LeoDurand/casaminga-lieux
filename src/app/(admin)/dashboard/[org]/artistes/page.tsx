import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ArtistsView } from "@/components/mc/artists-view";
import { getOrganizationBySlug, getArtistsForOrg } from "@/lib/data";

export default async function ArtistesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const artists = await getArtistsForOrg(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Gestion du lieu · Résidences"
        title="Artistes"
        sub="Annuaire des artistes accueillis en résidence — profils, disciplines, contacts et démarches artistiques."
      />
      <ArtistsView artists={artists} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
