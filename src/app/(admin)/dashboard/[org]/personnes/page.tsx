import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { PersonsView } from "@/components/mc/persons-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";

export default async function PersonnesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const persons = await getPersonsForOrg(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="CRM humain"
        title="Personnes"
        sub="Le carnet vivant du lieu — membres, coworkers, bénévoles, intervenant·es, résident·es et partenaires réuni·es au même endroit."
      />
      <PersonsView
        persons={persons}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
