import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { RequestsView } from "@/components/mc/requests-view";
import { getOrganizationBySlug, getRequestsForOrg } from "@/lib/data";

export default async function DemandesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const requests = await getRequestsForOrg(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Boîte de réception"
        title="Demandes entrantes"
        sub="Le pont entre le site public et l'équipe — centralisez et traitez chaque message reçu : contact, résidence, coworking, réservation, partenariat…"
      />
      <RequestsView requests={requests} orgSlug={organization.slug} />
    </div>
  );
}
