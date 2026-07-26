import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { SubscribersView } from "@/components/mc/subscribers-view";
import { getOrganizationBySlug, getPersonsForOrg } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";

export default async function SubscribersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [persons, groups] = await Promise.all([
    getPersonsForOrg(organization.id),
    getMemberGroups(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/${org}/communication`}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-warmgray hover:text-coral"
        >
          <ArrowLeft className="size-3.5" /> Retour à Communication
        </Link>
        <PageHeader
          tag="Rayonnement"
          title="Abonnés à la newsletter"
          sub="Qui reçoit vos envois, qui s'est désabonné, et sur quelle preuve de consentement."
        />
      </div>

      <SubscribersView
        persons={persons}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
      />
    </div>
  );
}
