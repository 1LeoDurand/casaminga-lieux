import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMembershipCampaignsForOrg, getTiersForCampaign } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";
import { PublicDonationForm } from "@/components/mc/public-donation-form";
import { createAdminClient } from "@/lib/admin/guard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  return { title: data ? `Soutenir — ${data.displayName}` : "Lieu introuvable" };
}

function fmt(n: number) {
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

export default async function SoutenirPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  if (!data || !data.content.pages.soutenir) notFound();

  const { org, displayName, content: c } = data;
  const t = getTheme(c.theme);
  const accent = c.accent_color || t.preview.accent;
  const nav = buildNav(org.slug, c);

  const campaignsRaw = await getMembershipCampaignsForOrg(org.id);
  const campaigns = campaignsRaw.filter((cp) => cp.status === "publie");
  const campaignTiers = await Promise.all(
    campaigns.map(async (cp) => ({ id: cp.id, tiers: await getTiersForCampaign(cp.id) }))
  );
  const tiersMap = Object.fromEntries(campaignTiers.map((ct) => [ct.id, ct.tiers]));

  // Campagnes de dons publiques (module Dons)
  let donationCampaigns: { id: string; title: string }[] = [];
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("donation_campaigns")
      .select("id, title")
      .eq("organization_id", org.id)
      .eq("is_public", true)
      .neq("status", "terminee")
      .order("created_at", { ascending: false });
    donationCampaigns = data ?? [];
  }

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-3xl px-6 pb-4 pt-14 text-center">
        <h1 className={t.classes.h1}>Soutenir le lieu</h1>
        <p className={`mx-auto mt-4 max-w-xl ${t.classes.body}`}>
          {c.soutenir_text ||
            `${displayName} vit grâce à celles et ceux qui le soutiennent. Adhérer ou donner, c'est faire exister un lieu ouvert à toutes et tous.`}
        </p>
      </section>

      {/* Adhésion */}
      {campaigns.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className={t.classes.h2}>Adhérer</h2>
          <p className={`mt-2 ${t.classes.muted}`}>
            L&apos;adhésion se fait en ligne, en quelques minutes.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((cp) => {
              const tiers = tiersMap[cp.id] ?? [];
              const amounts = tiers.map((tr) => Number(tr.amount));
              const minAmt = amounts.length ? Math.min(...amounts) : null;
              const maxAmt = amounts.length ? Math.max(...amounts) : null;
              const priceRange =
                amounts.length === 0 ? null
                : minAmt === maxAmt ? fmt(minAmt!)
                : `de ${fmt(minAmt!)} à ${fmt(maxAmt!)}`;
              return (
                <div key={cp.id} className={`flex flex-col p-6 ${t.classes.card}`}>
                  <h3 className={`text-lg font-bold ${t.classes.heading}`}>{cp.title}</h3>
                  {cp.description ? (
                    <p className={`mt-2 flex-1 text-sm ${t.classes.muted}`}>{cp.description}</p>
                  ) : <div className="flex-1" />}
                  {priceRange ? (
                    <p className="mt-3 text-[13px] font-semibold" style={{ color: accent }}>
                      {tiers.length} formule{tiers.length > 1 ? "s" : ""} · {priceRange}
                    </p>
                  ) : null}
                  <Link
                    href={`/site/${org.slug}/adhesion/${cp.slug}`}
                    className={`mt-4 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${t.classes.btn}`}
                    style={{ background: accent }}
                  >
                    Adhérer
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Don */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className={`p-8 ${t.classes.card}`}>
          <h2 className={t.classes.h2}>Faire un don</h2>
          <p className={`mt-3 max-w-2xl ${t.classes.body}`}>
            Votre don finance directement les activités du lieu. Si l&apos;association est
            d&apos;intérêt général, il ouvre droit à une <strong>réduction d&apos;impôt de 66&nbsp;%</strong>
            {" "}(article 200 du CGI) — un don de 50&nbsp;€ ne vous coûte que 17&nbsp;€, et un reçu
            fiscal vous est délivré.
          </p>
          <div className="mt-6">
            <PublicDonationForm slug={org.slug} accent={accent} campaigns={donationCampaigns} />
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
