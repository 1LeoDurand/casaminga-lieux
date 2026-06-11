import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { SitePublicEditor } from "@/components/mc/site-public-editor";
import { getOrganizationBySlug } from "@/lib/data";
import { getSiteConfig } from "@/lib/site-public/data";

export default async function SitePublicPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const config = await getSiteConfig(organization.id, organization.slug, organization.name);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Communication"
        title="Site public"
        sub="Personnalisez la vitrine de votre lieu : photos, présentation, sections. Publiez quand vous êtes prêt."
      />
      <SitePublicEditor config={config} orgId={organization.id} orgSlug={organization.slug} />
    </div>
  );
}
