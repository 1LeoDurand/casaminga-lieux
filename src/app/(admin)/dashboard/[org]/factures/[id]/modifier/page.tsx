import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { InvoiceEditor } from "@/components/mc/invoice-editor";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getInvoiceById, getInvoiceSettings } from "@/lib/invoicing/data";
import { getPolesForOrg } from "@/lib/poles";
import { getActiveEstablishments } from "@/lib/establishments";

export default async function ModifierFacturePage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [invoice, persons, settings, poles, establishments] = await Promise.all([
    getInvoiceById(organization.id, id),
    getPersonsForOrg(organization.id),
    getInvoiceSettings(organization.id),
    getPolesForOrg(organization.id),
    getActiveEstablishments(organization.id),
  ]);
  if (!invoice) notFound();
  // Une facture émise est figée → pas de modification.
  if (invoice.status !== "brouillon") redirect(`/dashboard/${org}/factures/${id}`);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/${org}/factures/${id}`} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark">
        <ArrowLeft className="size-4" /> Retour à la facture
      </Link>
      <PageHeader tag="Modifier" title="Modifier le brouillon" sub="Les modifications ne sont possibles que tant que la facture n'est pas émise." />
      <InvoiceEditor
        orgId={organization.id}
        orgSlug={org}
        invoiceId={invoice.id}
        persons={persons.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        defaultTermsDays={settings.payment_terms_days}
        poles={poles}
        establishments={establishments}
        initial={{
          client_id: invoice.client_id,
          client_name: invoice.client_name,
          client_email: invoice.client_email,
          client_address: invoice.client_address,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          lines: invoice.lines,
          vat_applicable: invoice.vat_applicable,
          notes: invoice.notes,
          object: invoice.object,
          reference: invoice.reference,
          pole_id: invoice.pole_id,
          establishment_id: invoice.establishment_id,
          payment_method: invoice.payment_method,
        }}
      />
    </div>
  );
}
