import { NextResponse } from "next/server";
import { corsPreflight, isForeignOrigin, withCors, type CorsOptions } from "@/lib/http/cors";
import { verifyPortalToken } from "@/lib/portal/token";
import { getPortalDataByEmail } from "@/lib/portal/data";
import { toPortalView } from "@/lib/portal/public-view";

/**
 * GET /api/espace/donnees : données de l'espace adhérent pour casaminga.com.
 * Jeton en en-tête Authorization: Bearer, jamais dans l'URL (journaux, Referer).
 * Contrat dans docs/API-ESPACE.md.
 */

export const dynamic = "force-dynamic";

const CORS: CorsOptions = { methods: ["GET"], headers: ["Authorization"] };

// Données personnelles : ni le navigateur ni un cache intermédiaire ne gardent la réponse.
const NO_STORE = { "Cache-Control": "no-store" };

function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return withCors(
    req,
    NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } }),
    CORS
  );
}

export function OPTIONS(req: Request) {
  return corsPreflight(req, CORS);
}

export async function GET(req: Request) {
  if (isForeignOrigin(req)) return json(req, { error: "forbidden_origin" }, 403);

  const match = /^Bearer\s+([A-Za-z0-9_.-]+)$/.exec(req.headers.get("authorization") ?? "");
  const token = match?.[1] ?? "";
  const email = token ? verifyPortalToken(token) : null;

  // Même 401 pour un jeton absent, altéré ou expiré : ne pas aider à distinguer.
  if (!email) return json(req, { error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });

  const data = await getPortalDataByEmail(email);
  if (!data) return json(req, { error: "unavailable" }, 503);

  return json(req, toPortalView(data, token));
}
