/**
 * « Ne plus m'écrire » en un clic : POST /api/contact/<jeton>/stop.
 *
 * C'est la cible de `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058) des
 * envois sortants, et aussi celle que la page /contact/<jeton>/stop appelle au
 * chargement. Contrat de src/app/api/unsubscribe/[token]/route.ts :
 *  - aucune confirmation demandée ;
 *  - 204 pour un jeton invalide, expiré, falsifié ou inconnu, SANS effet et
 *    sans rien révéler (pas d'énumération) ;
 *  - un GET ne désinscrit jamais (les filtres de messagerie ouvrent les liens) :
 *    il renvoie vers la page.
 *
 * Écart assumé : si le jeton est authentique mais que l'enregistrement échoue
 * (base indisponible), on répond 500 plutôt que 204. Un 204 mensonger
 * laisserait le prochain envoi partir alors que la personne s'est opposée ;
 * seul le porteur d'un jeton authentique peut le constater.
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { clientIp, resolveContactToken } from "@/lib/outreach/link-token";
import { optOutContact } from "@/lib/outreach/optout";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Jeton d'abord. `skipRateLimit` : l'opposition est idempotente et n'est jamais refusée
  // pour cause de débit (un serveur de messagerie peut rappeler plusieurs fois).
  const link = await resolveContactToken(token, "stop", { ip: clientIp(req.headers), skipRateLimit: true });
  if (!link) return new Response(null, { status: 204, headers: HEADERS });

  // RFC 8058 envoie « List-Unsubscribe=One-Click » ; la page envoie « via=page ».
  let via: "page" | "one_click" = "one_click";
  try {
    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > 0 && length <= 1024) {
      const body = await req.text();
      if (/(^|&)via=page(&|$)/.test(body)) via = "page";
    }
  } catch {
    // corps illisible : on traite comme un envoi RFC 8058
  }

  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("no admin client");
    await optOutContact(admin, {
      contactId: link.contact.id,
      threadId: link.thread.id,
      source: via === "page" ? "lien" : "list_unsubscribe",
      via,
    });
  } catch {
    // Pas de détail dans les journaux : ni jeton, ni adresse.
    console.error("[contact] opt-out failed after a valid token");
    return new Response(null, { status: 500, headers: HEADERS });
  }
  return new Response(null, { status: 204, headers: HEADERS });
}

/** Un humain qui arrive ici (client exotique) voit la page, jamais du JSON, et rien n'est enregistré. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return new Response(null, {
    status: 307,
    headers: { ...HEADERS, Location: `/contact/${encodeURIComponent(token)}/stop` },
  });
}
