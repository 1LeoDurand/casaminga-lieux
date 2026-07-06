import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrganizationBySlug, getEvenementById } from "@/lib/data";
import { getPublishedSiteContent } from "@/lib/site-public/data";
import { mergeSiteContent } from "@/lib/site-public/types";
import { PublicEventPage } from "@/components/mc/public-event-page";
import { remainingSeats } from "@/lib/events/register";
import { JsonLd } from "@/components/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const [org, event] = await Promise.all([
    getOrganizationBySlug(slug),
    getEvenementById(id),
  ]);
  if (!org || !event) return { title: "Événement introuvable" };
  return {
    title: `${event.title} · ${org.name}`,
    description: event.description?.slice(0, 160) ?? undefined,
  };
}

export default async function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const [org, event] = await Promise.all([
    getOrganizationBySlug(slug),
    getEvenementById(id),
  ]);

  if (!org || !event) notFound();

  // L'événement doit être publié et appartenir à cet org
  if (event.organization_id !== org.id || event.status !== "publie") notFound();

  const [rawContent, remaining] = await Promise.all([
    getPublishedSiteContent(org.id),
    event.capacity ? remainingSeats(event.id) : Promise.resolve(null),
  ]);
  const c = mergeSiteContent(rawContent);
  const accent = c.accent_color || org.primary_color || "#FF8A65";

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start_at,
    endDate: event.end_at,
    eventStatus: "https://schema.org/EventScheduled",
    description: event.description ?? undefined,
    image: event.photos?.[0] ?? undefined,
    location: {
      "@type": "Place",
      name: org.name,
    },
    organizer: {
      "@type": "Organization",
      name: org.name,
      url: `https://admin.casaminga.com/site/${slug}`,
    },
    ...(event.price != null && {
      offers: {
        "@type": "Offer",
        price: String(event.price),
        priceCurrency: "EUR",
        url: `https://admin.casaminga.com/site/${slug}/agenda/${event.id}`,
        availability:
          remaining === 0
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
      },
    }),
  };

  return (
    <>
      <JsonLd data={eventJsonLd} />
      <PublicEventPage
        event={event}
        org={org}
        accent={accent}
        orgSlug={slug}
        remaining={remaining}
        stripeEnabled={!!(org.stripe_account_id && org.stripe_charges_enabled)}
      />
    </>
  );
}
