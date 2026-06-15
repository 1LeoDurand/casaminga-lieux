import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { ContractsView } from "@/components/mc/contracts-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getPolesForOrg } from "@/lib/poles";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getContractsForOrg } from "./actions";

export const dynamic = "force-dynamic";

async function getDocuments(orgId: string): Promise<{ id: string; title: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, title")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function ContratsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [contracts, persons, poles, documents] = await Promise.all([
    getContractsForOrg(organization.id),
    getPersonsForOrg(organization.id),
    getPolesForOrg(organization.id),
    getDocuments(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure"
        title="Contrats & échéances"
        sub="Assurances, baux, conventions — ne ratez plus un renouvellement ni un préavis."
      />
      <ContractsView
        contracts={contracts}
        persons={persons}
        poles={poles}
        documents={documents}
        orgSlug={org}
        orgId={organization.id}
      />
    </div>
  );
}
