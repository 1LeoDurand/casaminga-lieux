import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { InventoryView } from "@/components/mc/inventory-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { getAssetsForOrg, getMaintenanceForOrg } from "./actions";

export const dynamic = "force-dynamic";

export default async function InventairePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [assets, maintenance, persons, poles] = await Promise.all([
    getAssetsForOrg(organization.id),
    getMaintenanceForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getPolesForOrg(organization.id),
  ]);

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
        orgSlug={org}
        orgId={organization.id}
      />
    </div>
  );
}
