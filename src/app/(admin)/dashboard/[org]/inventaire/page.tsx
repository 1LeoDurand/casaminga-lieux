import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { InventoryView } from "@/components/mc/inventory-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { getActiveEstablishments } from "@/lib/establishments";
import { getSelectedLieuId, filterByLieu } from "@/lib/establishment-scope";
import { getAssetsForOrg, getMaintenanceForOrg } from "./actions";

export const dynamic = "force-dynamic";

export default async function InventairePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [allAssets, maintenance, persons, poles, establishments] = await Promise.all([
    getAssetsForOrg(organization.id),
    getMaintenanceForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getPolesForOrg(organization.id),
    getActiveEstablishments(organization.id),
  ]);

  const selectedLieuId = await getSelectedLieuId(organization.slug, establishments);
  const assets = filterByLieu(allAssets, selectedLieuId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Gestion du lieu"
        title="Inventaire & Matériel"
        sub="Ce que vous possédez, où, dans quel état, qui l'a — et le suivi des pannes."
      />
      <InventoryView
        assets={assets}
        maintenance={maintenance}
        persons={persons}
        poles={poles}
        establishments={establishments}
        selectedLieuId={selectedLieuId}
        orgSlug={org}
        orgId={organization.id}
      />
    </div>
  );
}
