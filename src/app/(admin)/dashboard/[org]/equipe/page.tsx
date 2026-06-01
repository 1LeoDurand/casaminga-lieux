import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { TeamView } from "@/components/mc/team-view";
import { getOrganizationBySlug, getTeamMembers } from "@/lib/data";

export default async function EquipePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const members = await getTeamMembers(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Système · Accès & rôles"
        title="Équipe"
        sub="Gérez les membres de votre équipe, leurs rôles et leurs accès au lieu."
      />
      <TeamView members={members} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
