import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CommunicationView } from "@/components/mc/communication-view";
import { getOrganizationBySlug, getAnnouncementsForOrg } from "@/lib/data";
export default async function CommunicationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const announcements = await getAnnouncementsForOrg(organization.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Rayonnement" title="Communication" sub="Annonces internes, messages à la communauté et au public — gérés depuis un seul endroit." />
      <CommunicationView announcements={announcements} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
