import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ExpensesView } from "@/components/mc/expenses-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getExpensesForOrg } from "./actions";
import { getPolesForOrg } from "@/lib/poles";
import { getActiveEstablishments } from "@/lib/establishments";
import { getSelectedLieuId, filterByLieu } from "@/lib/establishment-scope";

export default async function DepensesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [allExpenses, persons, poles, establishments] = await Promise.all([
    getExpensesForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getPolesForOrg(organization.id),
    getActiveEstablishments(organization.id),
  ]);

  const selectedLieuId = await getSelectedLieuId(organization.slug, establishments);
  const expenses = filterByLieu(allExpenses, selectedLieuId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure"
        title="Dépenses"
        sub="Charges et justificatifs — suivez vos sorties par pôle d'activité."
      />
      <ExpensesView
        expenses={expenses}
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
