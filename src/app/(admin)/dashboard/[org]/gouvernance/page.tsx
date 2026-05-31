import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { GouvernanceView } from "@/components/mc/gouvernance-view";
import { getOrganizationBySlug, getMeetingsForOrg, getMandatesForOrg, getPersonsForOrg } from "@/lib/data";

export default async function GouvernancePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [meetings, mandates, persons] = await Promise.all([
    getMeetingsForOrg(organization.id),
    getMandatesForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Vie associative" title="Gouvernance"
        sub="Instances et mandats — réunions (CA, AG, bureau), ordres du jour, comptes-rendus et rôles élus." />
      <GouvernanceView meetings={meetings} mandates={mandates} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
