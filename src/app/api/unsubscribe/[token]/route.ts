/**
 * Désinscription en un clic — RFC 8058.
 *
 * C'est l'URL portée par l'en-tête `List-Unsubscribe` des envois de masse.
 * Gmail et Yahoo affichent alors leur propre bouton « Se désabonner » en tête
 * de message et appellent ce POST directement, sans que le destinataire
 * n'ouvre quoi que ce soit.
 *
 * Deux règles de la RFC valent d'être rappelées :
 *  - le POST ne doit demander AUCUNE confirmation ;
 *  - il doit répondre 2xx même sur un token inconnu. Une erreur ferait croire
 *    au fournisseur que nous refusons les désinscriptions, ce qui coûte plus
 *    cher que la désinscription elle-même.
 */

import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter/data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (token && token !== "preview") {
    await unsubscribeByToken(token, "one_click");
  }
  return new NextResponse(null, { status: 204 });
}

/** Un humain qui atterrit ici (client mail exotique) doit voir la page, pas du JSON. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, BASE_URL));
}
