import { notFound } from "next/navigation";
import { RequestsBoard } from "@/components/mc/requests-board";
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
    <div className="flex flex-col gap-8">
      <div>
        <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
          Activité
        </span>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
          Demandes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le pont entre le site public et l&apos;équipe — chaque message reçu
          devient une demande à traiter.
        </p>
      </div>

      <RequestsBoard requests={requests} orgSlug={organization.slug} />
    </div>
  );
}
