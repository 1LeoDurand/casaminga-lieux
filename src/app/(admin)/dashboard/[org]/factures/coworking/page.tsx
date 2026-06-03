import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { CoworkingView } from "@/components/mc/coworking-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getCoworkingSubscriptions } from "@/lib/invoicing/data";

export default async function CoworkingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [subs, persons] = await Promise.all([
    getCoworkingSubscriptions(organization.id),
    getPersonsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/${org}/factures`} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark">
        <ArrowLeft className="size-4" /> Retour aux factures
      </Link>
      <PageHeader
        tag="Facturation récurrente"
        title="Espace de coworking"
        sub="Chaque coworker, son tarif mensuel. Le 1er du mois, une facture est générée et envoyée automatiquement."
      />
      <CoworkingView
        subscriptions={subs}
        persons={persons.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        orgId={organization.id}
        orgSlug={org}
      />
    </div>
  );
}
