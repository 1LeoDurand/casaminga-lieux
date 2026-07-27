/**
 * Sitemap d'un site servi sur son domaine personnalisé — monlieu.fr/sitemap.xml
 *
 * Le proxy réécrit vers `/site/<slug>/sitemap.xml`. L'origine est déduite de
 * l'en-tête `Host` : sur un domaine personnalisé, les URL canoniques sont
 * celles de ce domaine, et le site y est servi à la racine (pas de slug).
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import {
  getPublishedSites,
  getUpcomingEventIds,
  siteEntries,
  renderSitemap,
  XML_HEADERS,
} from "@/lib/site-public/sitemap-data";

export const revalidate = 3600;

const APEX_HOSTS = ["casaminga.com", "www.casaminga.com"];

function isCustomDomain(host: string): boolean {
  return (
    host !== "" &&
    host !== "localhost" &&
    !APEX_HOSTS.includes(host) &&
    !host.endsWith(".casaminga.com")
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sites = await getPublishedSites();
  const site = sites.find((s) => s.slug === slug);
  if (!site) return new NextResponse("Not found", { status: 404 });

  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();

  const base = isCustomDomain(host)
    ? `https://${host}`
    : `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/${site.slug}`;

  const events = (await getUpcomingEventIds([site.orgId]))[site.orgId] ?? [];

  return new NextResponse(renderSitemap(siteEntries(base, site, events)), {
    headers: XML_HEADERS,
  });
}
