import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { SpacesView } from "@/components/mc/spaces-view";
import { getOrganizationBySlug, getSpacesForOrg } from "@/lib/data";
import { getActiveEstablishments } from "@/lib/establishments";

export default async function EspacesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [spaces, establishments] = await Promise.all([
    getSpacesForOrg(organization.id),
    getActiveEstablishments(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Catalogue du lieu"
        title="Espaces"
        sub="Le catalogue des lieux à réserver — salles, ateliers, bureaux et extérieurs, avec capacité, surface, tarifs et photos."
      />
      <SpacesView
        spaces={spaces}
        establishments={establishments}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
