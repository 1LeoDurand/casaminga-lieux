import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrganizationBySlug, getEvenementById } from "@/lib/data";
import { getPublishedSiteContent } from "@/lib/site-public/data";
import { mergeSiteContent } from "@/lib/site-public/types";
import { PublicEventPage } from "@/components/mc/public-event-page";

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

  const rawContent = await getPublishedSiteContent(org.id);
  const c = mergeSiteContent(rawContent);
  const accent = c.accent_color || org.primary_color || "#FF8A65";

  return (
    <PublicEventPage
      event={event}
      org={org}
      accent={accent}
      orgSlug={slug}
    />
  );
}
