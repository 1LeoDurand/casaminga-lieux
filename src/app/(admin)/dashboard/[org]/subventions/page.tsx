import { notFound } from "next/navigation";
import Link from "next/link";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { GrantsView } from "@/components/mc/grants-view";
import { GrantDossiersHub } from "@/components/mc/grant-dossiers-hub";
import { getOrganizationBySlug, getGrantsForOrg } from "@/lib/data";
import { getFollowedDossiers } from "@/lib/grants/data";

export default async function SubventionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [grants, dossiers] = await Promise.all([
    getGrantsForOrg(organization.id),
    getFollowedDossiers(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Structure · Financement public"
        title="Subventions"
        sub="Suivi des conventions pluriannuelles, versements et indicateurs d'impact pour vos financeurs."
        actions={
          <Link href={`/dashboard/${org}/subventions/veille`} className="mc-dq-btn primary">
            <Radar className="mc-dq-ic size-4" /> Trouver des financements
          </Link>
        }
      />
      <GrantDossiersHub dossiers={dossiers} orgSlug={organization.slug} />
      <GrantsView grants={grants} orgSlug={organization.slug} orgId={organization.id} />
    </div>
  );
}
