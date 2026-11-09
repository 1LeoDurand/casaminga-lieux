import { createAdminClient } from "@/lib/admin/guard";
import { corsPreflight, isForeignOrigin, withCors, type CorsOptions } from "@/lib/http/cors";
import { rateLimit } from "@/lib/rate-limit";
import {
  CacheLru,
  Coalescence,
  FileSaturee,
  Semaphore,
  cleCanonique,
  estFonctionAgenda,
  ipClient,
  lireParametres,
  type FonctionAgenda,
  type Parametres,
} from "@/lib/agenda/proxy-core";

/**
 * Proxy de l'agenda public.
 *
 *   GET /api/agenda/series?p=<JSON en base64url>
 *   GET /api/agenda/compteurs?p=...
 *   GET /api/agenda/epingles?p=...
 *
 * casaminga.com lit l'agenda ici plutôt que d'appeler les trois fonctions
 * SQL en direct avec la clé publique. La route met en cache 60 s, fusionne
 * les demandes identiques, borne à 4 les lectures simultanées de la base et
 * limite chaque adresse à 30 requêtes par 10 s. Conception et mesures :
 * 08 Import evenements/Conception/T2-5-limitation-de-debit.md (option 2).
 *
 * La réponse est exactement ce que rend la fonction SQL (le site garde sa
 * mise en forme). La clé de service ne donne ici rien de plus que la clé
 * publique : les trois fonctions sont `security definer`, leurs conditions
 * de publication sont écrites en dur.
 *
 * Exclue du proxy Next (src/proxy.ts) : aucune session à rafraîchir.
 */

export const dynamic = "force-dynamic";

const CORS: CorsOptions = { methods: ["GET"], headers: [] };

const DUREE_CACHE_MS = 60_000;
const cache = new CacheLru<string>(500, DUREE_CACHE_MS);
const coalescence = new Coalescence<string>();
/** 4 lectures en vol, comme le jeton de la base (0038) ; 20 en attente. */
const semaphore = new Semaphore(4, 20);

const RPC: Record<FonctionAgenda, string> = {
  series: "agenda_series",
  compteurs: "agenda_compteurs",
  epingles: "agenda_epingles",
};

/** PostgREST coupe une réponse à 1 000 lignes : les épingles se lisent par tranches. */
const LIGNES_PAR_REPONSE = 1000;
const PAGES_EPINGLES_MAX = 10;

class BaseSaturee extends Error {}

async function lireBase(fonction: FonctionAgenda, params: Parametres): Promise<string> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase non configuré");

  if (fonction !== "epingles") {
    const { data, error } = await admin.rpc(RPC[fonction], params);
    if (error) {
      // 53400 : le jeton de concurrence de la base (0038) n'a pas eu de place.
      if (error.code === "53400") throw new BaseSaturee();
      throw new Error(error.message);
    }
    return JSON.stringify(data ?? null);
  }

  const toutes: unknown[] = [];
  for (let page = 0; page < PAGES_EPINGLES_MAX; page += 1) {
    const { data, error } = await admin
      .rpc(RPC.epingles, params)
      .range(page * LIGNES_PAR_REPONSE, (page + 1) * LIGNES_PAR_REPONSE - 1);
    if (error) {
      if (error.code === "53400") throw new BaseSaturee();
      throw new Error(error.message);
    }
    const lot = (data ?? []) as unknown[];
    toutes.push(...lot);
    if (lot.length < LIGNES_PAR_REPONSE) break;
  }
  return JSON.stringify(toutes);
}

function reponse(req: Request, corps: string, status: number, entetes: Record<string, string>): Response {
  return withCors(
    req,
    new Response(corps, {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...entetes },
    }),
    CORS
  );
}

function erreur(req: Request, status: number, code: string, entetes: Record<string, string> = {}): Response {
  return reponse(req, JSON.stringify({ error: code }), status, { "Cache-Control": "no-store", ...entetes });
}

export function OPTIONS(req: Request) {
  return corsPreflight(req, CORS);
}

export async function GET(req: Request, { params }: { params: Promise<{ fonction: string }> }) {
  const { fonction } = await params;
  if (!estFonctionAgenda(fonction)) return erreur(req, 404, "not_found");
  if (isForeignOrigin(req)) return erreur(req, 403, "forbidden");

  const ip = ipClient(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
  if (!rateLimit(`agenda:${ip}`, 30, 10_000)) {
    return erreur(req, 429, "too_many_requests", { "Retry-After": "10" });
  }

  const parametres = lireParametres(fonction, new URL(req.url).searchParams.get("p"));
  if (!parametres) return erreur(req, 400, "bad_parameters");

  const cle = cleCanonique(fonction, parametres);
  // Un cache navigateur d'une minute : le même visiteur qui revient sur la
  // page ne redemande rien. `Vary: Origin` est posé par withCors.
  const publique = { "Cache-Control": "public, max-age=60" };

  const enCache = cache.lire(cle);
  if (enCache !== undefined) return reponse(req, enCache, 200, { ...publique, "X-Agenda-Cache": "hit" });

  try {
    const corps = await coalescence.executer(cle, () =>
      semaphore.executer(async () => {
        const lu = await lireBase(fonction, parametres);
        cache.ecrire(cle, lu);
        return lu;
      })
    );
    return reponse(req, corps, 200, { ...publique, "X-Agenda-Cache": "miss" });
  } catch (e) {
    if (e instanceof FileSaturee || e instanceof BaseSaturee) {
      return erreur(req, 503, "busy", { "Retry-After": "5" });
    }
    console.error(`api/agenda/${fonction}:`, e);
    return erreur(req, 502, "upstream");
  }
}
