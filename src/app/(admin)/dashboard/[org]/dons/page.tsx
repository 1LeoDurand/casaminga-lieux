import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { DonsView } from "@/components/mc/dons-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { getDonationsForOrg, getDonationCampaignsForOrg } from "./actions";

export const dynamic = "force-dynamic";

export default async function DonsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [donations, campaigns, persons, poles] = await Promise.all([
    getDonationsForOrg(organization.id),
    getDonationCampaignsForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getPolesForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure"
        title="Dons & mécénat"
        sub="Collectez, remerciez, éditez les reçus fiscaux — votre 3ᵉ pilier de financement."
      />
      <DonsView
        donations={donations}
        campaigns={campaigns}
        persons={persons}
        poles={poles}
        orgSlug={org}
        orgId={organization.id}
      />
    </div>
  );
}
