import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { VeilleView } from "@/components/mc/veille-view";
import { getOrganizationBySlug } from "@/lib/data";
import { getOpportunities, getOrgGrantProfile } from "@/lib/grants/data";

export default async function VeillePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [opportunities, profile] = await Promise.all([
    getOpportunities(),
    getOrgGrantProfile(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/${org}/subventions`} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark">
        <ArrowLeft className="size-4" /> Retour aux subventions
      </Link>
      <PageHeader
        tag="Veille & opportunités"
        title="Trouver des financements"
        sub="Les subventions et appels à projets compatibles avec votre lieu, classés par pertinence."
      />
      <VeilleView
        opportunities={opportunities}
        profile={profile}
        defaultStructure={organization.structure}
        orgId={organization.id}
        orgSlug={org}
      />
    </div>
  );
}
