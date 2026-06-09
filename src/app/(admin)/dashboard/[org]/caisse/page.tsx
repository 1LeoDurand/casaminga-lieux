import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CashRegisterView } from "@/components/mc/cash-register-view";
import { getOrganizationBySlug, getCashEntries, getCashClosures, getPostedClosureIds, getPersonsForOrg } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { getPointedEntryIds } from "@/lib/cash-pointing";

export default async function CaissePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [entries, closures, poles, pointedSet, postedClosureIds, persons] = await Promise.all([
    getCashEntries(organization.id),
    getCashClosures(organization.id),
    getPolesForOrg(organization.id),
    getPointedEntryIds(organization.id),
    getPostedClosureIds(organization.id),
    getPersonsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure · Conformité"
        title="Caisse certifiée"
        sub="Encaissements inaltérables, clôtures et piste d'audit — conforme à la loi anti-fraude TVA (NF525)."
      />
      <CashRegisterView
        entries={entries}
        closures={closures}
        poles={poles}
        persons={persons}
        pointedIds={Array.from(pointedSet)}
        postedClosureIds={Array.from(postedClosureIds)}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
