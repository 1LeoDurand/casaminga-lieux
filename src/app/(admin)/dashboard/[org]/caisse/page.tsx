import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { CashRegisterView } from "@/components/mc/cash-register-view";
import { getOrganizationBySlug, hasCashAccess, getCashEntries, getCashClosures, getPostedClosureIds, getPersonsForOrg, getCashShortcuts } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { getPointedEntryIds } from "@/lib/cash-pointing";
import { getActiveEstablishments } from "@/lib/establishments";
import { getSelectedLieuId } from "@/lib/establishment-scope";

export default async function CaissePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  // Same rule as the database (admin or perm_caisse, active member).
  if (!(await hasCashAccess(organization.id))) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader tag="Structure · Conformité" title="Caisse certifiée" />
        <div className="rounded-2xl border border-border bg-white px-5 py-10 text-center text-sm text-warmgray">
          Vous n&apos;avez pas accès à la caisse de cette structure.
        </div>
      </div>
    );
  }

  const [entries, closures, poles, pointedSet, postedClosureIds, persons, savedShortcuts, establishments] = await Promise.all([
    getCashEntries(organization.id),
    getCashClosures(organization.id),
    getPolesForOrg(organization.id),
    getPointedEntryIds(organization.id),
    getPostedClosureIds(organization.id),
    getPersonsForOrg(organization.id),
    getCashShortcuts(organization.id),
    getActiveEstablishments(organization.id),
  ]);
  const selectedLieuId = await getSelectedLieuId(organization.slug, establishments);

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
        establishments={establishments}
        selectedLieuId={selectedLieuId}
        shortcuts={savedShortcuts}
        pointedIds={Array.from(pointedSet)}
        postedClosureIds={Array.from(postedClosureIds)}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
