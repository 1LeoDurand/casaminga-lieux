import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrganizationBySlug,
  getPublicCampaignBySlug,
  getTiersForCampaign,
} from "@/lib/data";
import { AdhesionTunnel } from "@/components/mc/adhesion-tunnel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; campaignSlug: string }>;
}): Promise<Metadata> {
  const { slug, campaignSlug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) return { title: "Adhésion" };
  const campaign = await getPublicCampaignBySlug(org.id, campaignSlug);
  if (!campaign) return { title: "Adhésion introuvable" };
  return { title: `${campaign.title} — Adhésion`, description: campaign.description ?? undefined };
}

export default async function AdhesionTunnelPage({
  params,
}: {
  params: Promise<{ slug: string; campaignSlug: string }>;
}) {
  const { slug, campaignSlug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();
  const campaign = await getPublicCampaignBySlug(org.id, campaignSlug);
  if (!campaign) notFound();
  const tiers = await getTiersForCampaign(campaign.id);

  return (
    <main className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href={`/site/${org.slug}`} className="min-w-0 truncate font-heading text-base font-extrabold">{org.name}</Link>
          <span className="ml-auto shrink-0 text-sm text-muted-foreground">Adhésion</span>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-10">
        <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
          Rejoindre {org.name}
        </span>
        <h1 className="mt-4 font-heading text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">{campaign.title}</h1>
        <p className="mt-2 text-muted-foreground">
          Adhérez en quelques minutes. Vos informations arrivent directement à l&apos;équipe.
        </p>

        <div className="mt-8">
          <AdhesionTunnel
            slug={org.slug}
            campaign={campaign}
            tiers={tiers}
            stripeEnabled={!!(org.stripe_account_id && org.stripe_charges_enabled)}
          />
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
          <span>Adhésion gérée avec <span className="font-semibold text-foreground">Casa Minga Lieux</span></span>
          <Link href={`/site/${org.slug}`} className="hover:text-coral-dark">Retour au site du lieu</Link>
        </div>
      </footer>
    </main>
  );
}
