import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { PersonsView } from "@/components/mc/persons-view";
import { GroupsManager } from "@/components/mc/groups-manager";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";

export default async function PersonnesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [persons, groups] = await Promise.all([
    getPersonsForOrg(organization.id),
    getMemberGroups(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="CRM humain"
        title="Personnes"
        sub="Le carnet vivant du lieu — membres, coworkers, bénévoles, intervenant·es, résident·es et partenaires réuni·es au même endroit."
        actions={
          <GroupsManager
            groups={groups}
            persons={persons.map((p) => ({ id: p.id, name: p.name }))}
            orgId={organization.id}
            orgSlug={organization.slug}
          />
        }
      />
      <PersonsView
        persons={persons}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
