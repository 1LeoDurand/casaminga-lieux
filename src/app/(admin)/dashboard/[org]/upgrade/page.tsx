import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CustomDomainCard } from "@/components/mc/custom-domain-card";
import { getOrganizationBySlug } from "@/lib/data";
import { getCustomDomainState } from "@/app/(admin)/dashboard/[org]/site-public/actions";

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const domainState = await getCustomDomainState(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Communication"
        title="Nom de domaine"
        sub="Connectez votre propre adresse web à votre site Casa Minga. Le thème de votre choix s'applique sur votre domaine."
      />
      <div className="max-w-2xl">
        <CustomDomainCard
          orgId={organization.id}
          orgSlug={organization.slug}
          initial={domainState}
        />
      </div>
    </div>
  );
}
