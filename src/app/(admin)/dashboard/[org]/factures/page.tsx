import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Settings2, Users, Download } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { InvoicesView } from "@/components/mc/invoices-view";
import { getOrganizationBySlug } from "@/lib/data";
import { getInvoices, getInvoiceSettings } from "@/lib/invoicing/data";
import { createClient } from "@/lib/supabase/server";

export default async function FacturesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [invoices, settings] = await Promise.all([
    getInvoices(organization.id),
    getInvoiceSettings(organization.id),
  ]);

  let validatorName = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    validatorName = (user?.user_metadata?.full_name as string) || user?.email || "";
  } catch { /* demo */ }

  const configured = Boolean(settings.issuer_name);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Administration financière"
        title="Facturation"
        sub="Émettez, archivez et suivez vos factures. Numérotation séquentielle continue et conforme."
        actions={
          <>
            <Link href={`/dashboard/${org}/factures/coworking`} className="mc-dq-btn">
              <Users className="mc-dq-ic size-4" /> Coworking
            </Link>
            <a href={`/dashboard/${org}/factures/export`} className="mc-dq-btn">
              <Download className="mc-dq-ic size-4" /> Export CSV
            </a>
            <Link href={`/dashboard/${org}/factures/parametres`} className="mc-dq-btn">
              <Settings2 className="mc-dq-ic size-4" /> Paramètres
            </Link>
            <Link href={`/dashboard/${org}/factures/nouvelle`} className="mc-dq-btn primary">
              <Plus className="mc-dq-ic size-4" /> Nouvelle facture
            </Link>
          </>
        }
      />

      {!configured && (
        <div className="rounded-xl border border-golden/40 bg-golden/10 px-4 py-3 text-sm text-[#92400e]">
          <strong>Avant d'émettre :</strong> renseignez l'identité de votre structure (nom, adresse,
          SIRET, IBAN…) dans{" "}
          <Link href={`/dashboard/${org}/factures/parametres`} className="font-semibold underline">
            Paramètres de facturation
          </Link>
          . Ces informations apparaîtront sur chaque facture.
        </div>
      )}

      <InvoicesView invoices={invoices} orgSlug={org} validatorName={validatorName} />
    </div>
  );
}
