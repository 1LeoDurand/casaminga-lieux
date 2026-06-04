import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ModulesView } from "@/components/mc/modules-view";
import { getOrganizationBySlug } from "@/lib/data";
import { getEnabledModules } from "@/lib/modules-data";

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const enabledModules = await getEnabledModules(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Personnalisation"
        title="Modules"
        sub="Activez uniquement les outils dont votre lieu a besoin. Vos données sont toujours conservées."
      />
      <ModulesView
        orgId={organization.id}
        orgSlug={organization.slug}
        enabledModules={enabledModules}
      />
    </div>
  );
}
