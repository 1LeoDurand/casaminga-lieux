/**
 * Pixel d'ouverture.
 *
 * Répond TOUJOURS une image, quoi qu'il arrive : jeton inconnu, base
 * indisponible, suivi désactivé. Un pixel cassé dessine une icône d'image
 * manquante dans le message du destinataire — la mesure ne doit jamais abîmer
 * ce qu'elle mesure.
 *
 * Rappel de fiabilité : la plupart des clients masquent les images par défaut,
 * et Gmail les récupère via son proxy. Le taux d'ouverture est donc un
 * indicateur de tendance, pas un décompte exact.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/newsletter/events";

// GIF transparent 1×1, le plus petit fichier image valide.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function image(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Sans cela, le proxy d'images de Gmail servirait sa copie et la
      // deuxième ouverture ne nous parviendrait jamais.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ delivery: string }> }
) {
  const { delivery } = await params;
  try {
    await recordEvent(delivery, "ouverture");
  } catch {
    /* jamais bloquant */
  }
  return image();
}
