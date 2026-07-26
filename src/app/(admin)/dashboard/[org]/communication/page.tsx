import { notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { CommunicationView } from "@/components/mc/communication-view";
import { NewsletterList } from "@/components/mc/newsletter-list";
import { getOrganizationBySlug, getAnnouncementsForOrg } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";
import { getNewsletterCampaigns, getNewsletterSettings, getCampaignStats } from "@/lib/newsletter/data";

export default async function CommunicationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [announcements, campaigns, settings, groups, stats] = await Promise.all([
    getAnnouncementsForOrg(organization.id),
    getNewsletterCampaigns(organization.id),
    getNewsletterSettings(organization.id),
    getMemberGroups(organization.id),
    getCampaignStats(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        tag="Rayonnement"
        title="Communication"
        sub="Newsletter automatique, annonces internes et messages à la communauté."
        actions={
          <Link
            href={`/dashboard/${organization.slug}/communication/abonnes`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40"
          >
            <Users className="size-3.5" /> Abonnés
          </Link>
        }
      />

      {/* Newsletter */}
      <NewsletterList
        campaigns={campaigns}
        settings={settings}
        orgId={organization.id}
        orgSlug={organization.slug}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))}
        stats={stats}
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
