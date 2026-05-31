import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { PartenairesView } from "@/components/mc/partenaires-view";
import { getOrganizationBySlug, getPartnersForOrg, getPersonsForOrg } from "@/lib/data";

export default async function PartenairesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [partners, persons] = await Promise.all([
    getPartnersForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Réseau" title="Partenaires"
        sub="L'annuaire des partenaires — collectivités, fondations, entreprises, associations et leurs interlocuteur·rices." />
      <PartenairesView partners={partners} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
