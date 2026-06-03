import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { InvoiceSettingsForm } from "@/components/mc/invoice-settings-form";
import { getOrganizationBySlug } from "@/lib/data";
import { getInvoiceSettings } from "@/lib/invoicing/data";

export default async function FactureParametresPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const settings = await getInvoiceSettings(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/dashboard/${org}/factures`}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark"
      >
        <ArrowLeft className="size-4" /> Retour aux factures
      </Link>
      <PageHeader
        tag="Personnalisation"
        title="Paramètres de facturation"
        sub="Ces informations apparaissent sur chaque facture émise par votre structure."
      />
      <InvoiceSettingsForm settings={settings} orgId={organization.id} orgSlug={org} orgName={organization.name} />
    </div>
  );
}
