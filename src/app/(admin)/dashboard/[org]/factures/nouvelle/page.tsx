import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { InvoiceEditor } from "@/components/mc/invoice-editor";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getInvoiceSettings } from "@/lib/invoicing/data";
import { getPolesForOrg } from "@/lib/poles";

export default async function NouvelleFacturePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [persons, settings, poles] = await Promise.all([
    getPersonsForOrg(organization.id),
    getInvoiceSettings(organization.id),
    getPolesForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/dashboard/${org}/factures`}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark"
      >
        <ArrowLeft className="size-4" /> Retour aux factures
      </Link>
      <PageHeader tag="Nouvelle facture" title="Créer une facture" sub="Enregistrée en brouillon — le numéro est attribué uniquement à l'émission." />
      <InvoiceEditor
        orgId={organization.id}
        orgSlug={org}
        persons={persons.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        defaultTermsDays={settings.payment_terms_days}
        poles={poles}
      />
    </div>
  );
}
