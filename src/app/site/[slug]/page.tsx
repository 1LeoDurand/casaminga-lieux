import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMembershipCampaignsForOrg,
  getOrganizationBySlug,
  getPublicSiteBySlug,
  getTiersForCampaign,
  getEvenementsForOrg,
} from "@/lib/data";
import { getPublishedSiteContent } from "@/lib/site-public/data";
import { mergeSiteContent } from "@/lib/site-public/types";
import { eventTypeLabel, eventRange, isFuture } from "@/lib/events-meta";
import { getEstablishmentForPublic } from "@/lib/establishments";
import type { Establishment } from "@/lib/types";
import { PublicContactForm } from "@/components/mc/public-contact-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (site) {
    return { title: site.title, description: site.seo_description ?? undefined };
  }
  // Vitrine par établissement
  const est = await getEstablishmentForPublic(slug);
  if (est) {
    const orgSite = await getPublicSiteBySlug(est.orgSlug);
    return {
      title: est.establishment.name,
      description: est.establishment.description ?? orgSite?.seo_description ?? undefined,
    };
  }
  return { title: "Lieu introuvable" };
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

  // Résolution : d'abord une org par slug ; sinon, un établissement (vitrine par lieu).
  let org = await getOrganizationBySlug(slug);
  let establishment: Establishment | null = null;
  if (!org) {
    const est = await getEstablishmentForPublic(slug);
    if (est) {
      establishment = est.establishment;
      org = await getOrganizationBySlug(est.orgSlug);
    }
  }
  if (!org) notFound();

  const site = await getPublicSiteBySlug(org.slug);
  if (!site) notFound();

  const [content, campaignsRaw, eventsRaw] = await Promise.all([
    getPublishedSiteContent(org.id),
    getMembershipCampaignsForOrg(org.id),
    getEvenementsForOrg(org.id),
  ]);
  const c = mergeSiteContent(content);
  const accent = c.accent_color || "#FF8A65";

  // Nom affiché = établissement si vitrine par lieu, sinon l'org mère.
  const displayName = establishment?.name ?? org.name;

  const campaigns = campaignsRaw.filter((cp) => cp.status === "publie");
  const events = eventsRaw
    .filter((e) => e.status === "publie" && isFuture(e.start_at) && e.show_on_public_site)
    .filter((e) => !establishment || e.establishment_id === establishment.id)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 6);

  const campaignTiers = await Promise.all(
    campaigns.map(async (cp) => ({ id: cp.id, tiers: await getTiersForCampaign(cp.id) }))
  );
  const tiersMap = Object.fromEntries(campaignTiers.map((ct) => [ct.id, ct.tiers]));

  const showLieu = c.sections.lieu && (c.about_text || c.gallery_urls.length > 0);
  const showAgenda = c.sections.agenda;
  const showAdherer = c.sections.adherer && campaigns.length > 0;
  const showContact = c.sections.contact;

  return (
    <main className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <span className="min-w-0 truncate font-heading text-lg font-extrabold">{displayName}</span>
          <nav className="ml-auto flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
            {showLieu ? <a href="#lieu" className="hover:opacity-70">Le lieu</a> : null}
            {showAgenda ? <a href="#agenda" className="hover:opacity-70">Agenda</a> : null}
            {showAdherer ? <a href="#adherer" className="font-semibold" style={{ color: accent }}>Adhérer</a> : null}
            {showContact ? <a href="#contact" className="hover:opacity-70">Contact</a> : null}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-14">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ background: `${accent}1a`, color: accent }}>
              {org.structure}
            </span>
            <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {displayName}
            </h1>
            {establishment?.address ? (
              <p className="mt-2 text-sm text-muted-foreground">📍 {establishment.address}</p>
            ) : null}
            {c.hero_tagline ? (
              <p className="mt-4 text-lg text-muted-foreground">{c.hero_tagline}</p>
            ) : org.description ? (
              <p className="mt-4 text-lg text-muted-foreground">{org.description}</p>
            ) : null}
            {(org.address || org.hours) ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {[org.address, org.hours].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {showAdherer ? (
              <a href="#adherer"
                className="mt-6 inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:hidden"
                style={{ background: accent }}>
                Adhérer au lieu
              </a>
            ) : null}
          </div>
          {/* Photo hero réelle ou dégradé */}
          {c.hero_image_url ? (
            <div className="aspect-video overflow-hidden rounded-2xl md:aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.hero_image_url} alt={org.name} className="size-full object-cover" />
            </div>
          ) : (
            <div className="aspect-video rounded-2xl bg-gradient-to-br from-peach-pale to-peach md:aspect-[4/3]" />
          )}
        </div>
      </section>

      {/* Le lieu */}
      {showLieu ? (
        <section id="lieu" className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-heading text-xl font-bold md:text-2xl">{c.about_title}</h2>
          {c.about_text ? (
            <div className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-muted-foreground">
              {c.about_text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : null}
          {c.gallery_urls.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.gallery_urls.map((url, i) => (
                <div key={i} className="aspect-video overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Agenda — vrais événements publiés */}
      {showAgenda ? (
        <section id="agenda" className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-heading text-xl font-bold md:text-2xl">Agenda</h2>
          {events.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-peach bg-peach-pale/40 px-6 py-10 text-center text-sm text-muted-foreground">
              Pas d&apos;événement prévu pour l&apos;instant — revenez bientôt&nbsp;!
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <Link key={e.id} href={`/site/${org.slug}/agenda/${e.id}`}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition hover:border-[var(--accent)]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                  style={{ "--accent": accent } as React.CSSProperties}>
                  {/* Photo miniature si dispo */}
                  {e.photos?.[0] ? (
                    <div className="mb-3 aspect-video overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.photos[0]} alt="" className="size-full object-cover transition group-hover:scale-105" />
                    </div>
                  ) : null}
                  <span className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ background: `${accent}1a`, color: accent }}>
                    {eventTypeLabel(e.type)}
                  </span>
                  <h3 className="mt-2.5 font-heading text-[15px] font-bold leading-snug">{e.title}</h3>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{eventRange(e.start_at, e.end_at)}</p>
                  {e.description ? <p className="mt-2 line-clamp-2 text-[12.5px] text-muted-foreground">{e.description}</p> : null}
                  <span className="mt-3 text-[12px] font-semibold" style={{ color: accent }}>
                    {e.price === 0 || e.price === null ? "Entrée libre" : `${e.price} €`} →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Adhérer */}
      {showAdherer ? (
        <section id="adherer" className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-heading text-xl font-bold md:text-2xl">Adhérer</h2>
          <p className="mt-2 text-muted-foreground">
            Rejoignez le lieu et soutenez le projet. L&apos;adhésion se fait en ligne, en quelques minutes.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((cp) => {
              const tiers = tiersMap[cp.id] ?? [];
              const amounts = tiers.map((t) => Number(t.amount));
              const minAmt = amounts.length ? Math.min(...amounts) : null;
              const maxAmt = amounts.length ? Math.max(...amounts) : null;
              const priceRange =
                amounts.length === 0 ? null
                : minAmt === maxAmt ? fmt(minAmt!)
                : `de ${fmt(minAmt!)} à ${fmt(maxAmt!)}`;
              return (
                <div key={cp.id} className="flex flex-col rounded-2xl border border-border/60 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="font-heading text-lg font-bold">{cp.title}</h3>
                  {cp.description ? (
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{cp.description}</p>
                  ) : <div className="flex-1" />}
                  {priceRange ? (
                    <p className="mt-3 text-[13px] font-semibold" style={{ color: accent }}>
                      {tiers.length} formule{tiers.length > 1 ? "s" : ""} · {priceRange}
                    </p>
                  ) : null}
                  <Link href={`/site/${org.slug}/adhesion/${cp.slug}`}
                    className="mt-4 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: accent }}>
                    Adhérer
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Contact */}
      {showContact ? (
        <section id="contact" className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <h2 className="font-heading text-xl font-bold md:text-2xl">Nous écrire</h2>
            <p className="mt-2 text-muted-foreground">
              Résidence, réservation, partenariat, bénévolat… Votre message arrive directement à l&apos;équipe.
            </p>
            <PublicContactForm slug={slug} />
          </div>
        </section>
      ) : null}

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
          <span>Site généré avec <span className="font-semibold text-foreground">Casa Minga Lieux</span></span>
        </div>
      </footer>
    </main>
  );
}
