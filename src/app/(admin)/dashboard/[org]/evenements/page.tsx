import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/mc/page-header";
import { EventsView } from "@/components/mc/events-view";
import { getOrganizationBySlug, getEvenementsForOrg, getSpacesForOrg } from "@/lib/data";
import { getActiveEstablishments } from "@/lib/establishments";

export default async function EvenementsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [evenements, spaces, establishments] = await Promise.all([
    getEvenementsForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getActiveEstablishments(organization.id),
  ]);

  // Lieu sélectionné via le switcher topbar (cookie) → pré-filtre la vue
  const cookieStore = await cookies();
  const rawLieuId = cookieStore.get(`cm_lieu_${organization.slug}`)?.value ?? null;
  const initialEstablishmentId = establishments.some((e) => e.id === rawLieuId) ? rawLieuId : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Programmation du lieu"
        title="Événements"
        sub="Ateliers, concerts, expositions, marchés — la programmation publique et interne du lieu."
      />
      <EventsView evenements={evenements} spaces={spaces} establishments={establishments} orgSlug={organization.slug} orgId={organization.id} initialEstablishmentId={initialEstablishmentId} />
    </div>
  );
}
