import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { TachesView } from "@/components/mc/taches-view";
import { getOrganizationBySlug, getTasksForOrg, getPersonsForOrg } from "@/lib/data";

export default async function TachesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [tasks, persons] = await Promise.all([
    getTasksForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Pilotage" title="Tâches & alertes"
        sub="Le to-do transverse de l'équipe — kanban à faire / en cours / fait, échéances et alertes de retard." />
      <TachesView tasks={tasks} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
