import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Routing par host (architecture multi-surfaces) :
 *
 *   admin.casaminga.com/            → landing SaaS         (app/(admin)/page.tsx)
 *   admin.casaminga.com/dashboard/[org]                    (app/(admin)/dashboard/[org])
 *   casaminga.com/[slug]            → site public généré   réécrit vers /site/[slug]
 *
 * En local (localhost), aucune réécriture : tout est accessible directement,
 * le site public démo est à /site/bernard-kohn.
 */

const PUBLIC_APEX_HOSTS = ["casaminga.com", "www.casaminga.com"];

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const { pathname } = request.nextUrl;

  // Host public (apex) : casaminga.com/<slug> → /site/<slug>
  // Exclusions : routes publiques propres (billet/scan/api) + le site lui-même.
  const APEX_PASSTHROUGH = ["/site", "/billet", "/scan", "/api"];
  if (PUBLIC_APEX_HOSTS.includes(host) && !APEX_PASSTHROUGH.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = `/site${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
