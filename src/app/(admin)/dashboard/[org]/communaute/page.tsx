import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CommunauteView } from "@/components/mc/communaute-view";
import { getOrganizationBySlug, getCommunityPostsForOrg, getPersonsForOrg } from "@/lib/data";

export default async function CommunautePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [posts, persons] = await Promise.all([
    getCommunityPostsForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Vie du collectif" title="Communauté"
        sub="Le fil d'entraide entre membres — offres, demandes, covoiturage, prêts de matériel et infos." />
      <CommunauteView posts={posts} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
