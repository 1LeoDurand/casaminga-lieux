import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ImpactView, type AutoStats } from "@/components/mc/impact-view";
import {
  getOrganizationBySlug, getImpactIndicatorsForOrg,
  getReservationsForOrg, getEvenementsForOrg, getPersonsForOrg,
  getSpacesForOrg, getTransactionsForOrg,
} from "@/lib/data";
import { getCoordinationNotes } from "@/lib/coordination/data";

export default async function ImpactPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [indicators, reservations, evenements, persons, spaces, transactions, notes] = await Promise.all([
    getImpactIndicatorsForOrg(organization.id),
    getReservationsForOrg(organization.id),
    getEvenementsForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getSpacesForOrg(organization.id),
    getTransactionsForOrg(organization.id),
    getCoordinationNotes(organization.id),
  ]);

  const auto: AutoStats = {
    reservations: reservations.length,
    reservationsConfirmees: reservations.filter((r) => r.status === "confirmee" || r.status === "terminee").length,
    evenements: evenements.length,
    evenementsPublies: evenements.filter((e) => e.status === "publie").length,
    personnes: persons.length,
    espaces: spaces.length,
    recettes: transactions.filter((t) => t.type === "recette").reduce((s, t) => s + Number(t.amount), 0),
    depenses: transactions.filter((t) => t.type === "depense").reduce((s, t) => s + Number(t.amount), 0),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Pilotage" title="Impact"
        sub="La mesure de l'impact du lieu — indicateurs agrégés en temps réel et indicateurs manuels pour vos bilans et subventions." />
      <ImpactView indicators={indicators} auto={auto} notes={notes} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
