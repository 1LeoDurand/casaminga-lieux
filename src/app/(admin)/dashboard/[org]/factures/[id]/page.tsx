import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/lib/data";
import { getInvoiceById, getInvoiceSettings } from "@/lib/invoicing/data";
import { InvoiceDetail } from "@/components/mc/invoice-detail";

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [invoice, settings] = await Promise.all([
    getInvoiceById(organization.id, id),
    getInvoiceSettings(organization.id),
  ]);
  if (!invoice) notFound();

  return <InvoiceDetail invoice={invoice} settings={settings} orgId={organization.id} orgSlug={org} />;
}
