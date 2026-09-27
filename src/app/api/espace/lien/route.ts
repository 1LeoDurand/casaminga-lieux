import { NextResponse } from "next/server";
import { corsPreflight, isForeignOrigin, withCors, type CorsOptions } from "@/lib/http/cors";
import { requestPortalLink } from "@/lib/portal/request-link";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/espace/lien : demande d'un lien d'espace adhérent par courriel.
 * Appelée par casaminga.com (retour "public") ; contrat dans docs/API-ESPACE.md.
 *
 * Réponse neutre : 200 { ok: true } que le courriel soit connu ou non, valide
 * ou non, limité ou non. Seules les erreurs de forme qui ne disent rien du
 * courriel (corps illisible, retour inconnu) reçoivent un 400.
 */

export const dynamic = "force-dynamic";

const CORS: CorsOptions = { methods: ["POST"], headers: ["Content-Type"] };

/** Par adresse IP : freine qui balaierait des listes de courriels depuis un même poste. */
const REQUESTS_PER_IP_PER_HOUR = 20;

/** Un corps légitime tient en quelques centaines d'octets. */
const MAX_BODY_BYTES = 2048;

const NO_STORE = { "Cache-Control": "no-store" };

function json(req: Request, body: unknown, status = 200): Response {
  return withCors(req, NextResponse.json(body, { status, headers: NO_STORE }), CORS);
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export function OPTIONS(req: Request) {
  return corsPreflight(req, CORS);
}

export async function POST(req: Request) {
  if (isForeignOrigin(req)) return json(req, { error: "forbidden_origin" }, 403);

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return json(req, { error: "invalid_body" }, 400);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(req, { error: "invalid_body" }, 400);
    body = JSON.parse(text);
  } catch {
    return json(req, { error: "invalid_body" }, 400);
  }
  if (!body || typeof body !== "object") return json(req, { error: "invalid_body" }, 400);

  const { email, retour } = body as Record<string, unknown>;
  if (retour !== "public" && retour !== "admin") return json(req, { error: "invalid_retour" }, 400);

  // Sans IP connue (en-tête absent), pas de limite par IP plutôt qu'un seau
  // commun à tout le monde, qui bloquerait tous les visiteurs à la fois.
  const ip = clientIp(req);
  const ipAllowed = !ip || rateLimit(`portal-link-ip:${ip}`, REQUESTS_PER_IP_PER_HOUR, 3_600_000);

  if (ipAllowed) {
    try {
      await requestPortalLink(email, retour);
    } catch {
      // Même réponse en cas de panne : une erreur visible trahirait un dossier existant.
    }
  }

  return json(req, { ok: true });
}
