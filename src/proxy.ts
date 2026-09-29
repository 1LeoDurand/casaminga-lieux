import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Routing par host (architecture multi-surfaces) :
 *
 *   admin.casaminga.com/            → landing SaaS         (app/(admin)/page.tsx)
 *   admin.casaminga.com/dashboard/[org]                    (app/(admin)/dashboard/[org])
 *   casaminga.com/[slug]            → site public généré   réécrit vers /site/[slug]
 *   monlieu.fr (domaine perso actif)→ site public de l'org réécrit vers /site/[slug]
 *
 * En local (localhost), aucune réécriture : tout est accessible directement,
 * le site public démo est à /site/demo-tiers-lieu.
 */

const PUBLIC_APEX_HOSTS = ["casaminga.com", "www.casaminga.com"];

/** Chemins servis tels quels quel que soit le host public (jamais réécrits vers /site). */
const HOST_PASSTHROUGH = [
  "/site", "/billet", "/scan", "/api",
  "/espace", "/unsubscribe", "/rejoindre", "/tache", "/aide",
  "/contact/",
];

/**
 * Liens signés du module Contacts (jeton dans le chemin) : pages et POST de
 * désinscription. Traités avant tout le reste, sur n'importe quel host :
 * ni réécriture vers /site, ni session Supabase (aucune dépendance à un
 * compte), et deux en-têtes posés sur chaque réponse pour que le jeton ne
 * sorte pas dans un Referer et que la page ne soit jamais indexée.
 */
function isContactLink(pathname: string): boolean {
  return pathname.startsWith("/contact/") || pathname.startsWith("/api/contact/");
}

/** Hosts techniques à ne jamais traiter comme domaine personnalisé. */
function isInternalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".casaminga.com") ||
    PUBLIC_APEX_HOSTS.includes(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || // IP brute
    !host.includes(".")                       // hostname technique sans point
  );
}

/**
 * Résout un domaine personnalisé → slug d'org, via l'API REST Supabase
 * (compatible Edge). Cache HTTP 60 s pour ne pas requêter à chaque hit.
 */
async function resolveCustomDomain(host: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("votre-projet")) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/public_sites?custom_domain=eq.${encodeURIComponent(host)}` +
        `&custom_domain_status=eq.active&status=eq.publie&select=slug`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { slug: string }[];
    return rows[0]?.slug ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  if (isContactLink(pathname)) {
    const res = NextResponse.next();
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const isPassthrough = HOST_PASSTHROUGH.some((p) => pathname.startsWith(p));

  // Host public (apex) : casaminga.com/<slug> → /site/<slug>
  if (PUBLIC_APEX_HOSTS.includes(host) && !isPassthrough) {
    const url = request.nextUrl.clone();
    url.pathname = `/site${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Domaine personnalisé actif : monlieu.fr/* → /site/<slug>/*
  if (!isInternalHost(host) && !isPassthrough) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/site/${slug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    // Domaine inconnu / pas encore actif : laisser passer (landing par défaut).
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // api/contact/ excluded: the proxy buffers request bodies and cuts them at 10 MB
    // (photo uploads), logging the URL, hence the signed token. Those routes set their
    // own no-referrer / noindex / no-store headers.
    "/((?!_next/static|_next/image|favicon.ico|api/contact/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
