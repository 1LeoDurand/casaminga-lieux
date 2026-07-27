/**
 * robots.txt du domaine public — casaminga.com/robots.txt
 *
 * Sans cette route, la demande était réécrite vers `/site/robots.txt` et
 * répondait 404 : les moteurs n'avaient aucun moyen de découvrir le sitemap
 * des sites de lieux.
 *
 * Distinct de `src/app/robots.ts`, qui sert admin.casaminga.com — les deux
 * domaines n'exposent pas les mêmes chemins.
 */

import { NextResponse } from "next/server";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

export const revalidate = 3600;

export async function GET() {
  const origin = PUBLIC_SITE_BASE.replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    // Chemins transactionnels servis tels quels par le proxy : rien à indexer,
    // et certains portent un jeton personnel.
    "Disallow: /api",
    "Disallow: /billet",
    "Disallow: /scan",
    "Disallow: /espace",
    "Disallow: /tache",
    "Disallow: /rejoindre",
    "Disallow: /unsubscribe",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
