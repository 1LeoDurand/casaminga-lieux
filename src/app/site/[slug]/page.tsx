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
import { applyHostTheme } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";
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

const THEME_KEYS = [
  "chaleureux", "galerie", "editorial", "brut",
  "botanique", "nuit", "pastel", "minimal", "terre", "ocean", "affiche",
] as const;

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { slug } = await params;
  const { theme: themePreview } = await searchParams;

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
  const c = await applyHostTheme(mergeSiteContent(content));
  // Aperçu de thème via ?theme=… (utilisé par l'éditeur, sans modifier le site)
  if (themePreview && (THEME_KEYS as readonly string[]).includes(themePreview)) {
    c.theme = themePreview as typeof THEME_KEYS[number];
  }
  const t = getTheme(c.theme);
  const accent = c.accent_color || t.preview.accent;

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

  const showLieu = c.sections.lieu && !c.pages.apropos && (c.about_text || c.gallery_urls.length > 0);
  const showAgenda = c.sections.agenda;
  const showAdherer = c.sections.adherer && campaigns.length > 0;
  const showContact = c.sections.contact;

  const nav = buildNav(org.slug, c, { hasCampaigns: campaigns.length > 0 });

  // ── Hero selon le thème ──────────────────────────────────────────────────
  const heroBadge = (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${accent}1a`, color: accent }}
    >
      {org.structure}
    </span>
  );
  const heroTagline = c.hero_tagline || org.description || "";
  const heroMeta = [org.address, org.hours].filter(Boolean).join(" · ");

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      {/* Hero */}
      {t.hero === "full" && c.hero_image_url ? (
        <section className="relative">
          <div className="h-[60vh] min-h-[380px] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.hero_image_url} alt={displayName} className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-6 pb-10">
            {heroBadge}
            <h1 className={`mt-3 ${t.classes.h1}`}>{displayName}</h1>
            {heroTagline ? <p className={`mt-3 max-w-2xl text-lg ${t.classes.muted}`}>{heroTagline}</p> : null}
          </div>
        </section>
      ) : t.hero === "center" ? (
        <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center">
          {heroBadge}
          <h1 className={`mt-5 ${t.classes.h1}`}>{displayName}</h1>
          {heroTagline ? <p className={`mx-auto mt-5 max-w-xl text-lg ${t.classes.body}`}>{heroTagline}</p> : null}
          {heroMeta ? <p className={`mt-4 text-sm ${t.classes.muted}`}>{heroMeta}</p> : null}
          {c.hero_image_url ? (
            <div className={`mt-10 aspect-[16/8] overflow-hidden ${t.classes.image}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.hero_image_url} alt={displayName} className="size-full object-cover" />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-6 pb-8 pt-14">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              {heroBadge}
              <h1 className={`mt-4 ${t.classes.h1}`}>{displayName}</h1>
              {establishment?.address ? (
                <p className={`mt-2 text-sm ${t.classes.muted}`}>📍 {establishment.address}</p>
              ) : null}
              {heroTagline ? <p className={`mt-4 text-lg ${t.classes.muted}`}>{heroTagline}</p> : null}
              {heroMeta ? <p className={`mt-4 text-sm ${t.classes.muted}`}>{heroMeta}</p> : null}
              {showAdherer || c.pages.soutenir ? (
                <Link
                  href={c.pages.soutenir ? `/site/${org.slug}/soutenir` : "#adherer"}
                  className={`mt-6 inline-flex items-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${t.classes.btn}`}
                  style={{ background: accent }}
                >
                  Soutenir le lieu
                </Link>
              ) : null}
            </div>
            {c.hero_image_url ? (
              <div className={`aspect-video overflow-hidden md:aspect-[4/3] ${t.classes.image}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.hero_image_url} alt={displayName} className="size-full object-cover" />
              </div>
            ) : (
              <div className={`aspect-video md:aspect-[4/3] ${t.classes.image}`} style={{ background: `${accent}26` }} />
            )}
          </div>
        </section>
      )}

      {/* Le lieu (si pas de page À propos dédiée) */}
      {showLieu ? (
        <section id="lieu" className="mx-auto max-w-5xl px-6 py-10">
          <h2 className={t.classes.h2}>{c.about_title}</h2>
          {c.about_text ? (
            <div className={`mt-4 max-w-3xl space-y-3 ${t.classes.body}`}>
              {c.about_text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : null}
          {c.gallery_urls.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.gallery_urls.map((url, i) => (
                <div key={i} className={`aspect-video overflow-hidden ${t.classes.image}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Agenda — aperçu (lien vers la page complète si active) */}
      {showAgenda ? (
        <section id="agenda" className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={t.classes.h2}>Agenda</h2>
            {c.pages.agenda && events.length > 0 ? (
              <Link href={`/site/${org.slug}/agenda`} className="text-sm font-semibold" style={{ color: accent }}>
                Tout l&apos;agenda →
              </Link>
            ) : null}
          </div>
          {events.length === 0 ? (
            <div className={`mt-6 px-6 py-10 text-center text-sm ${t.classes.card} ${t.classes.muted}`}>
              Pas d&apos;événement prévu pour l&apos;instant — revenez bientôt&nbsp;!
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/site/${org.slug}/agenda/${e.id}`}
                  className={`group flex flex-col p-5 transition hover:opacity-95 ${t.classes.card}`}
                >
                  {e.photos?.[0] ? (
                    <div className={`mb-3 aspect-video overflow-hidden ${t.classes.image}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.photos[0]} alt="" className="size-full object-cover transition group-hover:scale-105" />
                    </div>
                  ) : null}
                  <span
                    className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ background: `${accent}1a`, color: accent }}
                  >
                    {eventTypeLabel(e.type)}
                  </span>
                  <h3 className={`mt-2.5 text-[15px] font-bold leading-snug ${t.classes.heading}`}>{e.title}</h3>
                  <p className={`mt-1.5 text-[13px] ${t.classes.muted}`}>{eventRange(e.start_at, e.end_at)}</p>
                  {e.description ? <p className={`mt-2 line-clamp-2 text-[12.5px] ${t.classes.muted}`}>{e.description}</p> : null}
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
          <h2 className={t.classes.h2}>Adhérer</h2>
          <p className={`mt-2 ${t.classes.muted}`}>
            Rejoignez le lieu et soutenez le projet. L&apos;adhésion se fait en ligne, en quelques minutes.
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

      {/* Contact */}
      {showContact ? (
        <section id="contact" className="mx-auto max-w-5xl px-6 py-10">
          <div className={`p-8 ${t.classes.card}`}>
            <h2 className={t.classes.h2}>Nous écrire</h2>
            <p className={`mt-2 ${t.classes.muted}`}>
              Résidence, réservation, partenariat, bénévolat… Votre message arrive directement à l&apos;équipe.
            </p>
            <PublicContactForm slug={slug} />
          </div>
        </section>
      ) : null}
    </PublicSiteShell>
  );
}
