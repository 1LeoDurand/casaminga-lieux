/**
 * robots.txt d'un domaine personnalisé — monlieu.fr/robots.txt
 * (réécrit par le proxy vers /site/<slug>/robots.txt).
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

export const revalidate = 3600;

const APEX_HOSTS = ["casaminga.com", "www.casaminga.com"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  const custom =
    host !== "" && host !== "localhost" && !APEX_HOSTS.includes(host) && !host.endsWith(".casaminga.com");

  const sitemap = custom
    ? `https://${host}/sitemap.xml`
    : `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/${slug}/sitemap.xml`;

  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${sitemap}`, ""].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
