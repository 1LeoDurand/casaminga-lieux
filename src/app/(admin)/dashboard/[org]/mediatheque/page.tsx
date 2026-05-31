import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { MediathequeView } from "@/components/mc/mediatheque-view";
import { getOrganizationBySlug, getMediaForOrg } from "@/lib/data";
export default async function MediathequePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const media = await getMediaForOrg(organization.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Bibliothèque de médias" title="Médiathèque" sub="Photos, vidéos, audios — tous les fichiers visuels et sonores du lieu centralisés." />
      <MediathequeView media={media} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
