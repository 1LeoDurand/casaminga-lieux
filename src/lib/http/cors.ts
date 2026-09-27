/**
 * CORS à origines restreintes, pour les routes que casaminga.com appelle
 * depuis le navigateur (site statique, sans serveur ni secret).
 *
 * Pourquoi une liste fermée et pas "*" : ces routes lisent ou déclenchent des
 * actions sur des données personnelles. Seul le site public de Casaminga doit
 * pouvoir les appeler depuis une page web. La route publique agenda.json garde
 * son "*" à part : elle ne sert que des données publiques.
 *
 * Pas de cookies ni d'Access-Control-Allow-Credentials : l'identité passe par
 * un jeton explicite (en-tête Authorization), jamais par une session.
 *
 * Usage dans une route :
 *   const CORS = { methods: ["GET"], headers: ["Authorization"] };
 *   export function OPTIONS(req: Request) { return corsPreflight(req, CORS); }
 *   export async function GET(req: Request) {
 *     if (isForeignOrigin(req)) return withCors(req, forbidden(), CORS);
 *     ...
 *     return withCors(req, NextResponse.json(data), CORS);
 *   }
 */

export interface CorsOptions {
  /** Méthodes autorisées, hors OPTIONS (ajoutée d'office). */
  methods: string[];
  /** En-têtes de requête autorisés (Content-Type, Authorization...). */
  headers: string[];
}

/** Origines de production : le site public, avec et sans www (les deux répondent). */
const PRODUCTION_ORIGINS = ["https://casaminga.com", "https://www.casaminga.com"];

/** Serveur de prévisualisation de casa-minga-public (.claude/launch.json). */
const LOCAL_PUBLIC_ORIGIN = "http://localhost:5174";

/**
 * Origines autorisées. localhost:5174 n'est admis que hors production, ou sur
 * demande explicite (CORS_ALLOW_LOCALHOST=1) : `next start` tourne en
 * NODE_ENV=production même sur un poste de développement, et le site public
 * local doit pouvoir parler à un build local de l'admin. Cette variable ne
 * doit jamais être posée sur le serveur.
 */
export function allowedOrigins(): string[] {
  const allowLocal =
    process.env.NODE_ENV !== "production" || process.env.CORS_ALLOW_LOCALHOST === "1";
  return allowLocal ? [...PRODUCTION_ORIGINS, LOCAL_PUBLIC_ORIGIN] : PRODUCTION_ORIGINS;
}

/** L'origine de la requête si elle est autorisée, null sinon (ou absente). */
export function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins().includes(origin) ? origin : null;
}

/**
 * Vrai si la requête vient d'une page web d'une autre origine que celles
 * autorisées. Une requête sans en-tête Origin (curl, serveur à serveur) n'est
 * pas concernée : CORS ne protège que les navigateurs, et ces routes font
 * leurs propres contrôles. Refuser côté serveur ferme aussi les requêtes
 * « simples » (text/plain) qu'un navigateur envoie sans pré-vol.
 */
export function isForeignOrigin(req: Request): boolean {
  return req.headers.has("origin") && allowedOrigin(req) === null;
}

function applyCorsHeaders(req: Request, headers: Headers, opts: CorsOptions): void {
  // La réponse change selon l'origine : un cache intermédiaire ne doit pas
  // resservir à casaminga.com une réponse faite pour une autre origine.
  headers.append("Vary", "Origin");
  const origin = allowedOrigin(req);
  if (!origin) return;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", [...opts.methods, "OPTIONS"].join(", "));
  headers.set("Access-Control-Allow-Headers", opts.headers.join(", "));
  // Dix minutes : évite un pré-vol à chaque appel sans figer longtemps la règle.
  headers.set("Access-Control-Max-Age", "600");
}

/** Ajoute les en-têtes CORS à une réponse déjà construite et la renvoie. */
export function withCors<T extends Response>(req: Request, res: T, opts: CorsOptions): T {
  applyCorsHeaders(req, res.headers, opts);
  return res;
}

/**
 * Réponse au pré-vol OPTIONS. Origine refusée : 204 sans en-tête
 * Access-Control-*, le navigateur bloque alors la vraie requête.
 */
export function corsPreflight(req: Request, opts: CorsOptions): Response {
  const headers = new Headers();
  applyCorsHeaders(req, headers, opts);
  return new Response(null, { status: 204, headers });
}
