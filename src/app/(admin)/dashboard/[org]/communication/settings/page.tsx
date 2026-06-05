import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { getOrganizationBySlug } from "@/lib/data";
import { getMemberGroups } from "@/lib/member-groups";
import { getNewsletterSettings } from "@/lib/newsletter/data";
import { NewsletterSettingsForm } from "@/components/mc/newsletter-settings-form";

export default async function NewsletterSettingsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [settings, groups] = await Promise.all([
    getNewsletterSettings(organization.id),
    getMemberGroups(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/${org}/communication`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-warmgray hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Communication
        </Link>
        <span className="text-warmgray">/</span>
        <span className="text-sm font-bold text-ink">Réglages newsletter</span>
      </div>

      <PageHeader
        tag="Communication"
        title="Réglages newsletter"
        sub="Configurez la cadence d'envoi automatique et les préférences de votre infolettre."
      />

      <div className="max-w-2xl">
        <NewsletterSettingsForm
          settings={settings}
          orgId={organization.id}
          orgSlug={organization.slug}
          groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))}
        />
      </div>
    </div>
  );
}
