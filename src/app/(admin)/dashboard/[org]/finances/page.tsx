import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { FinancesView } from "@/components/mc/finances-view";
import { getOrganizationBySlug, getTransactionsForOrg, getPersonsForOrg } from "@/lib/data";

export default async function FinancesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [transactions, persons] = await Promise.all([
    getTransactionsForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Administration financière" title="Finances"
        sub="Recettes et dépenses du lieu — solde en temps réel, graphique mensuel et suivi des transactions." />
      <FinancesView transactions={transactions} persons={persons} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
