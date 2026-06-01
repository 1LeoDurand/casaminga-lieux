import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { GrantsView } from "@/components/mc/grants-view";
import { getOrganizationBySlug, getGrantsForOrg } from "@/lib/data";

export default async function SubventionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const grants = await getGrantsForOrg(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure · Financement public"
        title="Subventions"
        sub="Suivi des conventions pluriannuelles, versements et indicateurs d'impact pour vos financeurs."
      />
      <GrantsView grants={grants} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
