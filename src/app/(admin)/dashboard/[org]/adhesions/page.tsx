import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { AdhesionsView } from "@/components/mc/adhesions-view";
import {
  getOrganizationBySlug,
  getMembershipCampaignsForOrg,
  getTiersForCampaign,
  getApplicationsForCampaign,
} from "@/lib/data";
import type { MembershipApplication, MembershipTier } from "@/lib/types";

export default async function AdhesionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const campaigns = await getMembershipCampaignsForOrg(organization.id);

  const tiersEntries = await Promise.all(
    campaigns.map(async (c) => [c.id, await getTiersForCampaign(c.id)] as const)
  );
  const appsEntries = await Promise.all(
    campaigns.map(async (c) => [c.id, await getApplicationsForCampaign(c.id)] as const)
  );

  const tiersMap: Record<string, MembershipTier[]> = Object.fromEntries(tiersEntries);
  const applicationsMap: Record<string, MembershipApplication[]> = Object.fromEntries(appsEntries);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Structure" title="Adhésions"
        sub="Vos campagnes d'adhésion — formules, période de validité, souscriptions et tunnel public façon HelloAsso." />
      <AdhesionsView
        campaigns={campaigns}
        tiersMap={tiersMap}
        applicationsMap={applicationsMap}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
