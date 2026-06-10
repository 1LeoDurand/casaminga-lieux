import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { TaxReceiptsView } from "@/components/mc/tax-receipts-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getTaxReceipts } from "@/lib/tax-receipts/data";
import { getInvoiceSettings } from "@/lib/invoicing/data";

export default async function TaxReceiptsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [receipts, persons, settings] = await Promise.all([
    getTaxReceipts(organization.id),
    getPersonsForOrg(organization.id),
    getInvoiceSettings(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Finances · Fiscalité"
        title="Reçus fiscaux"
        sub="Générez les reçus Cerfa n° 11580*04 pour les dons déductibles d'impôt (article 200 CGI — réduction 66 %)."
      />
      <TaxReceiptsView
        receipts={receipts}
        persons={persons}
        orgSlug={organization.slug}
        eligible={settings.tax_receipt_eligible === true}
        rescritRef={settings.tax_receipt_rescrit_ref ?? null}
      />
    </div>
  );
}
