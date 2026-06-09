import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CommunicationView } from "@/components/mc/communication-view";
import { NewsletterList } from "@/components/mc/newsletter-list";
import { getOrganizationBySlug, getAnnouncementsForOrg } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";
import { getNewsletterCampaigns, getNewsletterSettings } from "@/lib/newsletter/data";

export default async function CommunicationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [announcements, campaigns, settings, groups] = await Promise.all([
    getAnnouncementsForOrg(organization.id),
    getNewsletterCampaigns(organization.id),
    getNewsletterSettings(organization.id),
    getMemberGroups(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        tag="Rayonnement"
        title="Communication"
        sub="Newsletter automatique, annonces internes et messages à la communauté."
      />

      {/* Newsletter */}
      <NewsletterList
        campaigns={campaigns}
        settings={settings}
        orgId={organization.id}
        orgSlug={organization.slug}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))}
      />

      {/* Séparateur */}
      <hr className="border-border" />

      {/* Annonces existantes */}
      <div>
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">Annonces internes</h2>
        <CommunicationView announcements={announcements} orgSlug={organization.slug} orgId={organization.id} />
      </div>
    </div>
  );
}
