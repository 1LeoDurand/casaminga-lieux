import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { SitePublicEditor } from "@/components/mc/site-public-editor";
import { getOrganizationBySlug } from "@/lib/data";
import { getSiteConfig } from "@/lib/site-public/data";
import { getCustomDomainState } from "@/app/(admin)/dashboard/[org]/site-public/actions";

export default async function SitePublicPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [config, domainState] = await Promise.all([
    getSiteConfig(organization.id, organization.slug, organization.name),
    getCustomDomainState(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Communication"
        title="Site public"
        sub="Personnalisez la vitrine de votre lieu : photos, présentation, sections. Publiez quand vous êtes prêt."
      />
      <SitePublicEditor
        config={config}
        orgId={organization.id}
        orgSlug={organization.slug}
        domainState={domainState}
      />
    </div>
  );
}
