import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { AutomatisationsView } from "@/components/mc/automatisations-view";
import { getOrganizationBySlug, getAutomationsForOrg } from "@/lib/data";

export default async function AutomatisationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const automations = await getAutomationsForOrg(organization.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Système" title="Automatisations"
        sub="Les règles « si… alors… » du lieu — relances, confirmations, rappels. L'exécution réelle est gérée côté serveur." />
      <AutomatisationsView automations={automations} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
