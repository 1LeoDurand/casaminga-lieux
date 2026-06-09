import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { DossierView } from "@/components/mc/dossier-view";
import { getOrganizationBySlug } from "@/lib/data";
import { getOpportunityById, getOrgGrantProfile, getApplications } from "@/lib/grants/data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Recettes encaissées sur les 12 derniers mois (approximation budget annuel). */
async function getAnnualRevenue(orgId: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("organization_id", orgId)
    .eq("type", "recette")
    .gte("date", since.toISOString().slice(0, 10));
  if (!data) return null;
  return data.reduce((sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0);
}

export default async function DossierPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [opp, profile, applications, annualRevenue] = await Promise.all([
    getOpportunityById(id),
    getOrgGrantProfile(organization.id),
    getApplications(organization.id),
    getAnnualRevenue(organization.id),
  ]);

  if (!opp) notFound();

  const initialApplication = applications.get(opp.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/dashboard/${org}/subventions/veille`}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark"
      >
        <ArrowLeft className="size-4" /> Retour à la veille
      </Link>
      <PageHeader
        tag="Dossier de candidature"
        title={opp.title}
        sub={opp.funder ?? "Préparez et suivez votre candidature étape par étape."}
      />
      <DossierView
        opp={opp}
        profile={profile}
        initialApplication={initialApplication}
        orgId={organization.id}
        orgSlug={org}
        orgName={organization.name}
        annualRevenue={annualRevenue}
      />
    </div>
  );
}
