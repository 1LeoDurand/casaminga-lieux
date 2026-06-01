import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMembershipCampaignsForOrg,
  getOrganizationBySlug,
  getPublicSiteBySlug,
  getTiersForCampaign,
} from "@/lib/data";
import { PublicContactForm } from "@/components/mc/public-contact-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) return { title: "Lieu introuvable" };
  return {
    title: site.title,
    description: site.seo_description ?? undefined,
  };
}

function fmt(n: number) {
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  const org = await getOrganizationBySlug(slug);
  if (!site || !org) notFound();

  const campaigns = (await getMembershipCampaignsForOrg(org.id)).filter(
    (c) => c.status === "publie"
  );

  // Fetch tiers for each campaign to display price range (UX-004)
  const campaignTiers = await Promise.all(
    campaigns.map(async (c) => ({ id: c.id, tiers: await getTiersForCampaign(c.id) }))
  );
  const tiersMap = Object.fromEntries(campaignTiers.map((ct) => [ct.id, ct.tiers]));

  return (
    <main className="min-h-screen bg-cream">
      {/* Nav — UX-023: min-w-0 truncate sur le nom + shrink-0 sur la nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <span className="min-w-0 truncate font-heading text-lg font-extrabold">{org.name}</span>
          <nav className="ml-auto flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
            <a href="#lieu" className="hover:text-coral-dark">Le lieu</a>
            <a href="#agenda" className="hover:text-coral-dark">Agenda</a>
            {campaigns.length > 0 ? <a href="#adherer" className="font-semibold text-coral-dark">Adhérer</a> : null}
            <a href="#contact" className="hover:text-coral-dark">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero — UX-024: text-3xl md:text-4xl */}
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-14">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
              {org.structure}
            </span>
            <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {org.name}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{org.description}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {org.address} · {org.hours}
            </p>
            {/* CTA héro mobile — UX-025 */}
            {campaigns.length > 0 ? (
              <a
                href="#adherer"
                className="mt-6 inline-flex items-center rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark md:hidden"
              >
                Adhérer au lieu
              </a>
            ) : null}
          </div>
          {/* UX-002 + UX-025: hero photo sans label dev, aspect-video sur mobile */}
          <div className="aspect-video rounded-2xl bg-gradient-to-br from-peach-pale to-peach md:aspect-[4/3]" />
        </div>
      </section>

      {/* Le lieu — UX-002 + UX-025: galerie masquée si pas de vraies photos */}
      <section id="lieu" className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-heading text-xl font-bold md:text-2xl">Découvrir le lieu</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* UX-002: gradient neutre, pas de label dev */}
          <div className="aspect-video rounded-2xl bg-gradient-to-br from-peach-pale to-peach" />
          <div className="aspect-video rounded-2xl bg-gradient-to-br from-peach to-peach-pale" />
          <div className="col-span-2 aspect-video rounded-2xl bg-gradient-to-br from-cream to-peach sm:col-span-1" />
        </div>
      </section>

      {/* Agenda — UX-001 + UX-030: message public */}
      <section id="agenda" className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-heading text-xl font-bold md:text-2xl">Agenda</h2>
        <p className="mt-2 text-muted-foreground">
          Les événements à venir du lieu apparaîtront ici.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-peach bg-peach-pale/40 px-6 py-10 text-center text-sm text-muted-foreground">
          Pas d&apos;événement prévu pour l&apos;instant — revenez bientôt&nbsp;!
        </div>
      </section>

      {/* Adhérer — UX-004: fourchette de prix */}
      {campaigns.length > 0 ? (
        <section id="adherer" className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-heading text-xl font-bold md:text-2xl">Adhérer</h2>
          <p className="mt-2 text-muted-foreground">
            Rejoignez le lieu et soutenez le projet. L&apos;adhésion se fait en ligne, en quelques minutes.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const tiers = tiersMap[c.id] ?? [];
              const amounts = tiers.map((t) => Number(t.amount));
              const minAmt = amounts.length ? Math.min(...amounts) : null;
              const maxAmt = amounts.length ? Math.max(...amounts) : null;
              const priceRange =
                amounts.length === 0
                  ? null
                  : minAmt === maxAmt
                  ? fmt(minAmt!)
                  : `de ${fmt(minAmt!)} à ${fmt(maxAmt!)}`;
              return (
                <div
                  key={c.id}
                  className="flex flex-col rounded-2xl border border-border/60 bg-white p-6 shadow-[0_4px_20px_rgba(255,138,101,0.07)]"
                >
                  <h3 className="font-heading text-lg font-bold">{c.title}</h3>
                  {c.description ? (
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {priceRange ? (
                    <p className="mt-3 text-[13px] font-semibold text-coral-dark">
                      {tiers.length} formule{tiers.length > 1 ? "s" : ""} · {priceRange}
                    </p>
                  ) : null}
                  <Link
                    href={`/site/${org.slug}/adhesion/${c.slug}`}
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark"
                  >
                    Adhérer
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgba(255,138,101,0.07)]">
          <h2 className="font-heading text-xl font-bold md:text-2xl">Nous écrire</h2>
          <p className="mt-2 text-muted-foreground">
            Résidence, réservation, partenariat, bénévolat… Votre message arrive
            directement à l&apos;équipe.
          </p>
          <PublicContactForm slug={slug} />
        </div>
      </section>

      {/* Footer — UX-003: lien admin retiré */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
          <span>
            Site généré avec{" "}
            <span className="font-semibold text-foreground">Casa Minga Lieux</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
