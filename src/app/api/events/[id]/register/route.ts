import { NextRequest, NextResponse } from "next/server";
import { registerForEvent } from "@/lib/events/register";
import { allowedOrigin, corsPreflight, withCors, type CorsOptions } from "@/lib/http/cors";

/**
 * Cette route a deux appelants légitimes : la page vitrine de l'admin
 * elle-même (`public-event-register-form.tsx`, appel même origine) et,
 * depuis le prompt 6, la fiche événement de casaminga.com. Contrairement aux
 * routes /api/espace/*, un appel même origine envoie quand même un en-tête
 * Origin pour un POST : il ne figure pas dans la liste autorisée par
 * `src/lib/http/cors.ts` (casaminga.com uniquement), donc `isForeignOrigin`
 * le traiterait à tort comme étranger. On distingue ici l'origine de l'admin
 * lui-même (aucun refus, aucun en-tête CORS ajouté : comportement inchangé)
 * d'une origine casaminga.com (CORS appliqué) et de toute autre origine
 * (403 avant toute lecture du corps).
 */
const CORS: CorsOptions = { methods: ["POST"], headers: ["Content-Type"] };

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req, CORS);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  const requestOrigin = req.headers.get("origin");
  const selfOrigin = new URL(req.url).origin;
  const isSameOrigin = requestOrigin === null || requestOrigin === selfOrigin;
  // Origine publique autorisée (casaminga.com, ou localhost:5174 en dev) :
  // non nulle seulement quand la requête ne vient pas de l'admin lui-même.
  const publicOrigin = isSameOrigin ? null : allowedOrigin(req);

  // Ni l'admin, ni casaminga.com : origine étrangère, refusée avant toute
  // lecture du corps, donc avant toute écriture.
  if (!isSameOrigin && !publicOrigin) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const respond = (body: Record<string, unknown>, status = 200) => {
    const res = NextResponse.json(body, { status });
    return publicOrigin ? withCors(req, res, CORS) : res;
  };

  let body: { full_name: string; email: string; phone?: string; participants?: string[]; notes?: string };
  try { body = await req.json(); } catch {
    return respond({ error: "Corps JSON invalide." }, 400);
  }

  const res = await registerForEvent({
    eventId,
    fullName: body.full_name ?? "",
    email: body.email ?? "",
    phone: body.phone,
    participants: body.participants,
    notes: body.notes,
    source: "public",
    // casaminga.com ne branche que la billetterie gratuite : aucune
    // organisation n'a de paiement en ligne actif aujourd'hui. L'appel
    // même origine (vitrine admin) garde son comportement actuel.
    rejectIfPaid: Boolean(publicOrigin),
  });

  if (!res.ok) {
    // Événement payant refusé côté casaminga.com : même statut 400 que les
    // autres refus de forme, avec un message clair (voir registerForEvent).
    const status = res.error === "Événement introuvable." ? 404
      : res.error === "Service non configuré." ? 503
      : 400;
    return respond({ error: res.error }, status);
  }
  return respond({ ok: true, status: res.status, id: res.registrationId, tickets: res.ticketsCount });
}
