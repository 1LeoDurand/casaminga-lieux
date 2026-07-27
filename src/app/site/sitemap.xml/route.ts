/**
 * Sitemap du domaine public — casaminga.com/sitemap.xml
 *
 * Le proxy réécrit `casaminga.com/sitemap.xml` vers `/site/sitemap.xml` :
 * cette route est donc bien celle que les moteurs atteignent. Un segment
 * statique l'emporte sur `[slug]`, il n'y a pas d'ambiguïté de routage.
 */

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

export async function GET() {
  const origin = PUBLIC_SITE_BASE.replace(/\/$/, "");
  const sites = await getPublishedSites();
  const events = await getUpcomingEventIds(sites.map((s) => s.orgId));

  const entries = sites.flatMap((site) =>
    siteEntries(`${origin}/${site.slug}`, site, events[site.orgId] ?? [])
  );

  return new NextResponse(renderSitemap(entries), { headers: XML_HEADERS });
}
