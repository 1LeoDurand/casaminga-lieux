/**
 * Redirection de clic.
 *
 * Règle non négociable : on redirige TOUJOURS vers la destination, même si
 * l'enregistrement échoue. Un lien de newsletter qui ne mène nulle part parce
 * que notre base était indisponible serait un dégât bien plus grand qu'une
 * statistique manquante.
 *
 * L'URL cible est signée (voir tracking.ts). Sans cette signature, l'adresse
 * ferait de notre domaine une redirection ouverte, utilisable pour maquiller
 * un lien d'hameçonnage derrière casaminga.com.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyClick } from "@/lib/newsletter/tracking";
import { recordEvent } from "@/lib/newsletter/events";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ delivery: string }> }
) {
  const { delivery } = await params;
  const target = req.nextUrl.searchParams.get("u");
  const sig = req.nextUrl.searchParams.get("s") ?? "";

  if (!target || !/^https?:\/\//i.test(target) || !verifyClick(delivery, target, sig)) {
    // Signature absente ou fausse : on ne suit personne vers une adresse qui
    // ne vient pas de nous. Retour à l'accueil plutôt qu'une page d'erreur.
    return NextResponse.redirect(BASE_URL, { status: 302 });
  }

  try {
    await recordEvent(delivery, "clic", target);
  } catch {
    /* jamais bloquant */
  }

  return NextResponse.redirect(target, { status: 302 });
}
