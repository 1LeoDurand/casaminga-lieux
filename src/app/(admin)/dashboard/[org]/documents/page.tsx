import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { DocumentsView } from "@/components/mc/documents-view";
import { getOrganizationBySlug, getDocumentsForOrg, getPersonsForOrg } from "@/lib/data";

export default async function DocumentsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();
  const [documents, persons] = await Promise.all([
    getDocumentsForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Administration" title="Documents"
        sub="Contrats, devis, factures, conventions — les documents du lieu centralisés et suivis." />
      <DocumentsView documents={documents} persons={persons} orgSlug={organization.slug} orgId={organization.id} orgName={organization.name} />
    </div>
  );
}
