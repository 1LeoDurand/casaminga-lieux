import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
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
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/${org}/personnes/importer`}
              className="flex items-center gap-1.5 rounded-xl border border-peach bg-peach-pale px-3 py-2 text-[12px] font-semibold text-foreground transition hover:border-coral hover:bg-peach"
            >
              <Upload className="size-3.5" /> Importer CSV
            </Link>
            <GroupsManager
              groups={groups}
              persons={persons.map((p) => ({ id: p.id, name: p.name }))}
              orgId={organization.id}
              orgSlug={organization.slug}
            />
          </div>
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
