/**
 * Lien signé du module Contacts : construction des URL et résolution d'un jeton.
 *
 * Règles (spec, section 8) :
 *  - le jeton est vérifié (HMAC) AVANT toute lecture en base ;
 *  - invalide, expiré, falsifié, fil inconnu, action absente du programme,
 *    limite de débit : une seule réponse, `null`, que l'appelant traduit par la
 *    même page « lien invalide » (aucune énumération possible) ;
 *  - un jeton est lié à un fil ET à une action (`bind`) : le lien « ne plus
 *    m'écrire » ne sert pas à déposer des photos ;
 *  - `stop` reste accepté au-delà de la durée de vie et après révocation des
 *    liens : s'opposer ne doit jamais être refusé pour cause de lien ancien ;
 *  - lecture par le client de service, côté serveur uniquement (jamais la clé anon).
 */
import "server-only";
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/guard";
import { scopedTokenAgeExceeded, signScopedToken, verifyScopedToken } from "@/lib/portal/token";
import { PORTAL_ADMIN_BASE } from "@/lib/portal/url";
import { rateLimit } from "@/lib/rate-limit";
import type {
  ContactAction, LinkContact, LinkProgram, LinkStage, LinkThread, ResolvedContactLink,
} from "./link-types";

export type { ContactAction } from "./link-types";

const DAY_MS = 86_400_000;

/** Limites de la spec 8.3 (mémoire du process, voir `allowLinkRequest`). */
const PER_THREAD_PER_HOUR = 30;
const PER_IP_PER_HOUR = 60;
const HOUR_MS = 3_600_000;

function isContactAction(a: string): a is ContactAction {
  return a === "photos" || a === "correction" || a === "stop" || a === "resolu" || a === "justificatif";
}

/**
 * URL d'une action pour un fil : `<base>/contact/<jeton>/<action>`.
 * `null` sans PORTAL_LINK_SECRET (l'appelant suspend alors l'envoi froid).
 */
export function contactActionUrl(threadId: string, action: ContactAction, issuedAtMs?: number): string | null {
  try {
    return `${PORTAL_ADMIN_BASE}/contact/${signScopedToken("o1", threadId, issuedAtMs, action)}/${action}`;
  } catch {
    return null;
  }
}

/** Cible de `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058), `null` sans secret. */
export function contactStopApiUrl(threadId: string, issuedAtMs?: number): string | null {
  try {
    return `${PORTAL_ADMIN_BASE}/api/contact/${signScopedToken("o1", threadId, issuedAtMs, "stop")}/stop`;
  } catch {
    return null;
  }
}

/** Adresse IP du visiteur, telle que la transmet le reverse proxy (non fiable, voir allowLinkRequest). */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "";
  return raw && raw.length <= 64 ? raw : null;
}

/**
 * Empreinte d'une IP pour la preuve d'accord : HMAC-SHA256 avec un domaine
 * propre (`ip|`), jamais l'adresse en clair. Sans secret ou sans IP : null.
 */
export function hashIp(ip: string | null): string | null {
  const secret = process.env.PORTAL_LINK_SECRET;
  if (!secret || !ip) return null;
  return createHmac("sha256", secret).update(`ip|${ip}`).digest("hex");
}

/**
 * Limitation de débit simple : 30 requêtes par heure et par fil, 60 par heure
 * et par IP. V1 : compteurs en MÉMOIRE du process (`src/lib/rate-limit.ts`),
 * suffisants pour une instance Node unique ; ils se remettent à zéro à chaque
 * redémarrage et ne se partagent pas entre instances. L'IP vient de
 * X-Forwarded-For, qu'un client peut usurper : c'est un frein, pas une garantie.
 * `perIp: false` pour l'opposition (une désinscription légitime ne doit jamais
 * être écartée parce qu'un serveur de messagerie partage son IP).
 */
export function allowLinkRequest(threadId: string, ip: string | null, opts: { perIp?: boolean } = {}): boolean {
  const okThread = rateLimit(`contact-link:thread:${threadId}`, PER_THREAD_PER_HOUR, HOUR_MS);
  if (opts.perIp === false || !ip) return okThread;
  const okIp = rateLimit(`contact-link:ip:${ip}`, PER_IP_PER_HOUR, HOUR_MS);
  return okThread && okIp;
}

/** Nombre de dépôts de fichiers autorisés par fil et par jour (spec 8.3). */
export function allowUploadAttempt(threadId: string): boolean {
  return rateLimit(`contact-link:upload:${threadId}`, 3, 24 * HOUR_MS);
}

/**
 * Résout un jeton pour une action. `null` dans tous les cas d'échec.
 * Ne consomme pas de compteur de débit pour un jeton dont la signature est fausse
 * (aucune donnée à protéger, et un attaquant ne doit pas pouvoir épuiser le
 * compteur d'un fil qu'il ne connaît pas).
 */
export async function resolveContactToken(
  token: string,
  action: string,
  opts: { ip?: string | null; now?: number; skipRateLimit?: boolean } = {}
): Promise<ResolvedContactLink | null> {
  if (!isContactAction(action)) return null;
  const now = opts.now ?? Date.now();

  // 1. Signature d'abord. Rien n'est lu tant qu'elle n'est pas bonne.
  const verified = verifyScopedToken("o1", token, now, action);
  if (!verified) return null;

  // 2. Débit (le fil est maintenant authentique).
  if (!opts.skipRateLimit && !allowLinkRequest(verified.subject, opts.ip ?? null, { perIp: action !== "stop" })) {
    return null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  try {
    return await loadLink(admin, verified.subject, action, verified.issuedAtMs, now);
  } catch {
    // Aucune trace du contenu : une panne de base ne doit pas fuiter dans les journaux.
    return null;
  }
}

async function loadLink(
  admin: SupabaseClient,
  threadId: string,
  action: ContactAction,
  issuedAtMs: number,
  now: number
): Promise<ResolvedContactLink | null> {
  const { data: thread } = await admin
    .from("outreach_threads")
    .select(
      "id, program_id, contact_id, address_id, article_id, status, closed_reason, last_outbound_at, " +
        "first_inbound_at, photos_granted_at, link_revoked_at"
    )
    .eq("id", threadId)
    .maybeSingle<LinkThread>();
  if (!thread) return null;

  const [programRes, settingsRes, contactRes, stagesRes, addressRes, articleRes] = await Promise.all([
    admin
      .from("outreach_programs")
      .select("id, slug, label, direction, address_form, link_actions")
      .eq("id", thread.program_id)
      .maybeSingle<Omit<LinkProgram, "link_ttl_days">>(),
    admin
      .from("outreach_settings")
      .select("link_ttl_days")
      .eq("program_id", thread.program_id)
      .maybeSingle<{ link_ttl_days: number }>(),
    admin
      .from("outreach_contacts")
      .select("id, name, do_not_contact")
      .eq("id", thread.contact_id)
      .maybeSingle<LinkContact>(),
    admin
      .from("outreach_program_stages")
      .select("slug, role")
      .eq("program_id", thread.program_id)
      .returns<LinkStage[]>(),
    thread.address_id
      ? admin.from("outreach_addresses").select("email").eq("id", thread.address_id).maybeSingle<{ email: string }>()
      : Promise.resolve({ data: null }),
    thread.article_id
      ? admin.from("outreach_articles").select("title").eq("id", thread.article_id).maybeSingle<{ title: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const program = programRes.data;
  const settings = settingsRes.data;
  const contact = contactRes.data;
  if (!program || !settings || !contact) return null;

  // L'action doit figurer dans les actions du programme du fil. Sauf `stop` : un jeton
  // « ne plus m'écrire » authentique a été émis par nous, et retirer `stop` des actions
  // d'un programme ne doit pas rendre muets les liens déjà envoyés (l'opposition vaut toujours).
  if (action !== "stop" && !program.link_actions.includes(action)) return null;

  // Expiration et révocation : toutes les actions sauf `stop`.
  if (action !== "stop") {
    if (thread.link_revoked_at) return null;
    if (scopedTokenAgeExceeded(issuedAtMs, settings.link_ttl_days * DAY_MS, now)) return null;
  }

  return {
    thread,
    program: { ...program, link_ttl_days: settings.link_ttl_days },
    contact,
    addressEmail: addressRes.data?.email ?? null,
    stages: stagesRes.data ?? [],
    articleTitle: articleRes.data?.title ?? null,
    issuedAtMs,
  };
}

/**
 * Journal d'événement du lien (append-only). N'échoue jamais : un événement
 * manquant ne doit pas bloquer l'action du visiteur. `data` ne contient ni
 * adresse ni corps de message (contrat de la spec 3.5).
 */
export async function logLinkEvent(
  admin: SupabaseClient,
  ev: { programId: string; threadId: string; contactId: string; type: string; data?: Record<string, unknown> }
): Promise<void> {
  try {
    await admin.from("outreach_events").insert({
      program_id: ev.programId,
      thread_id: ev.threadId,
      contact_id: ev.contactId,
      actor: "lien",
      type: ev.type,
      data: ev.data ?? {},
    });
  } catch {
    // journal facultatif
  }
}
