import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrganizationBySlug } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";
import { getNewsletterCampaign } from "@/lib/newsletter/data";
import { NewsletterEditor } from "@/components/mc/newsletter-editor";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignEditorPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const [organization, campaign, groups] = await Promise.all([
    getOrganizationBySlug(org),
    getNewsletterCampaign(id),
    getMemberGroups((await getOrganizationBySlug(org))?.id ?? ""),
  ]);

  if (!organization || !campaign) notFound();
  if (campaign.organization_id !== organization.id) notFound();

  // Email de l'utilisateur connecté (pré-remplir le champ "test à moi-même")
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "";

  const statusLabels: Record<string, string> = {
    brouillon:  "Brouillon",
    programmee: "Programmée",
    envoyee:    "Envoyée",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/${org}/communication`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-warmgray hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Communication
        </Link>
        <span className="text-warmgray">/</span>
        <span className="truncate text-sm font-bold text-ink">
          {campaign.sujet || "Sans titre"}
        </span>
        <span className="ml-1 rounded-full bg-warmgray/15 px-2.5 py-0.5 text-[11px] font-semibold text-warmgray">
          {statusLabels[campaign.statut] ?? campaign.statut}
        </span>
      </div>

      <NewsletterEditor
        campaign={campaign}
        orgId={organization.id}
        orgSlug={organization.slug}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))}
        userEmail={userEmail}
      />
    </div>
  );
}
