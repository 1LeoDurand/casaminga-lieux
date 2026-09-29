/**
 * Lien magique HMAC-SHA256, sans état, pour l'espace adhérent.
 *
 * Deux formats coexistent :
 *
 *   v2 (actuel) : base64url(email) + "." + émission + "." + base64url(HMAC("v2|" + email + "|" + émission))
 *                 où émission est le nombre de secondes depuis l'époque Unix, en base 36.
 *   v1 (ancien) : base64url(email) + "." + base64url(HMAC(email))
 *
 * Pourquoi une date d'émission : un lien v1 n'expire jamais, donc un courriel
 * transféré ou une boîte compromise donne un accès perpétuel à l'espace. Le v2
 * est refusé au-delà de PORTAL_TOKEN_TTL_MS.
 *
 * Pourquoi le préfixe "v2|" dans la signature : il sépare les deux domaines de
 * signature, pour qu'une signature v1 ne puisse jamais être recyclée en v2
 * (et inversement) en jouant sur la découpe des champs.
 *
 * Sans stockage en base : révocation globale en changeant PORTAL_LINK_SECRET.
 * Fermé par défaut : sans secret, la signature lève une erreur et la
 * vérification renvoie null. Comparaison en temps constant (timingSafeEqual).
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.PORTAL_LINK_SECRET ?? "";

/**
 * Durée de vie d'un lien v2 : 30 jours. Assez long pour qu'un adhérent
 * retrouve son espace depuis le même courriel pendant un mois, assez court
 * pour qu'un lien oublié dans une boîte ou transféré cesse de valoir.
 */
export const PORTAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fin de la période de transition pour les liens v1 (sans date), déjà envoyés
 * avant l'introduction de la durée de vie. Passé ce moment, ils sont refusés
 * et l'adhérent redemande un lien. Fixé au 31/12/2026 à minuit, heure de Paris.
 */
export const LEGACY_TOKEN_ACCEPTED_UNTIL = Date.parse("2027-01-01T00:00:00+01:00");

/**
 * Tolérance sur une date d'émission dans le futur : deux horloges de serveur
 * peuvent diverger de quelques secondes, pas de plusieurs minutes.
 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Normalise un courriel pour la signature et les recherches : espaces retirés, minuscules. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64url");
}

function fromBase64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", SECRET).update(payload).digest();
}

function v2Payload(email: string, issuedAt36: string): string {
  return `v2|${email}|${issuedAt36}`;
}

function sameSig(expected: Buffer, sigPart: string): boolean {
  const actual = Buffer.from(sigPart, "base64url");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Signe un courriel et renvoie un jeton v2, utilisable dans une URL.
 * Lève une erreur si PORTAL_LINK_SECRET n'est pas défini.
 * `issuedAtMs` n'existe que pour les tests (jeton expiré fabriqué exprès).
 */
export function signPortalToken(email: string, issuedAtMs: number = Date.now()): string {
  if (!SECRET) {
    throw new Error("PORTAL_LINK_SECRET is not set: cannot sign portal token");
  }
  const normalized = normalizeEmail(email);
  const issuedAt36 = Math.floor(issuedAtMs / 1000).toString(36);
  const emailPart = base64url(normalized);
  const sigPart = base64url(hmac(v2Payload(normalized, issuedAt36)));
  return `${emailPart}.${issuedAt36}.${sigPart}`;
}

/**
 * Vérifie un jeton, v2 ou v1 pendant la transition.
 * Renvoie le courriel normalisé si le jeton est valide et en cours de validité,
 * null sinon. Ne dit jamais pourquoi : l'appelant répond pareil dans tous les cas.
 */
export function verifyPortalToken(token: string, nowMs: number = Date.now()): string | null {
  if (!SECRET || typeof token !== "string" || token.length > 1024) return null;
  try {
    const parts = token.split(".");

    if (parts.length === 3) {
      const [emailPart, issuedAt36, sigPart] = parts;
      if (!emailPart || !/^[0-9a-z]{1,10}$/.test(issuedAt36)) return null;
      const email = normalizeEmail(fromBase64url(emailPart));
      if (!email) return null;
      // La signature d'abord : on ne lit la date qu'une fois sûr qu'elle est authentique.
      if (!sameSig(hmac(v2Payload(email, issuedAt36)), sigPart)) return null;
      const issuedAtMs = parseInt(issuedAt36, 36) * 1000;
      if (!Number.isFinite(issuedAtMs)) return null;
      if (issuedAtMs > nowMs + CLOCK_SKEW_MS) return null;
      if (nowMs - issuedAtMs > PORTAL_TOKEN_TTL_MS) return null;
      return email;
    }

    if (parts.length === 2) {
      if (nowMs >= LEGACY_TOKEN_ACCEPTED_UNTIL) return null;
      const [emailPart, sigPart] = parts;
      if (!emailPart) return null;
      const email = normalizeEmail(fromBase64url(emailPart));
      // Un "|" ne figure dans aucun courriel réel : le refuser ferme toute
      // confusion possible avec la charge signée d'un jeton v2.
      if (!email || email.includes("|")) return null;
      if (!sameSig(hmac(email), sigPart)) return null;
      return email;
    }

    return null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------
 * Jetons à domaine séparé (liens signés du module Contacts, /contact/<jeton>)
 *
 * Forme : <scope>.<sujet sans tirets>.<émission base 36>.<signature>
 *         signature = HMAC("<scope>|<sujet>|<émission>" [+ "|<action>"])
 *
 * Quatre segments, contre trois (v2) ou deux (v1) pour un jeton du portail :
 * verifyPortalToken() rejette un jeton scopé, et verifyScopedToken() rejette
 * un jeton du portail. Le préfixe de scope dans la charge signée empêche en
 * plus de recycler une signature d'un domaine dans l'autre.
 *
 * Scope "o1" (outreach) : le sujet est l'identifiant (uuid) d'un fil. Le jeton
 * peut être lié à une action (paramètre `bind`), signée avec lui : un lien
 * « ne plus m'écrire » ne permet alors pas de déposer des photos. L'expiration
 * dépend du programme du fil (link_ttl_days) : elle est jugée par l'appelant
 * à partir de `issuedAtMs`, ce fichier ne connaît pas la base.
 * ---------------------------------------------------------------------- */

export type TokenScope = "o1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX32_RE = /^[0-9a-f]{32}$/;
const BIND_RE = /^[a-z_]{1,30}$/;

function scopedPayload(scope: TokenScope, subject: string, issuedAt36: string, bind?: string): string {
  return bind ? `${scope}|${subject}|${issuedAt36}|${bind}` : `${scope}|${subject}|${issuedAt36}`;
}

/**
 * Signe un sujet (uuid de fil) pour un scope. `bind` lie le jeton à une action.
 * Lève une erreur sans PORTAL_LINK_SECRET ou avec un sujet qui n'est pas un uuid.
 */
export function signScopedToken(
  scope: TokenScope,
  subject: string,
  issuedAtMs: number = Date.now(),
  bind?: string
): string {
  if (!SECRET) {
    throw new Error("PORTAL_LINK_SECRET is not set: cannot sign scoped token");
  }
  const subj = subject.trim().toLowerCase();
  if (scope !== "o1" || !UUID_RE.test(subj)) throw new Error("invalid scoped token subject");
  if (bind !== undefined && !BIND_RE.test(bind)) throw new Error("invalid scoped token binding");
  const issuedAt36 = Math.floor(issuedAtMs / 1000).toString(36);
  const sigPart = base64url(hmac(scopedPayload(scope, subj, issuedAt36, bind)));
  return `${scope}.${subj.replace(/-/g, "")}.${issuedAt36}.${sigPart}`;
}

/**
 * Vérifie un jeton scopé : signature (temps constant) d'abord, puis date.
 * Renvoie le sujet et la date d'émission, ou null sans jamais dire pourquoi.
 * Un jeton signé avec `bind` ne se vérifie qu'avec le même `bind`.
 */
export function verifyScopedToken(
  scope: TokenScope,
  token: string,
  nowMs: number = Date.now(),
  bind?: string
): { subject: string; issuedAtMs: number } | null {
  if (!SECRET || typeof token !== "string" || token.length > 256) return null;
  if (bind !== undefined && !BIND_RE.test(bind)) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [tokScope, hex, issuedAt36, sigPart] = parts;
    if (tokScope !== scope || scope !== "o1") return null;
    if (!HEX32_RE.test(hex) || !/^[0-9a-z]{1,10}$/.test(issuedAt36)) return null;
    const subject = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (!sameSig(hmac(scopedPayload(scope, subject, issuedAt36, bind)), sigPart)) return null;
    const issuedAtMs = parseInt(issuedAt36, 36) * 1000;
    if (!Number.isFinite(issuedAtMs)) return null;
    if (issuedAtMs > nowMs + CLOCK_SKEW_MS) return null;
    return { subject, issuedAtMs };
  } catch {
    return null;
  }
}

/**
 * Un jeton scopé est-il trop vieux pour une durée de vie donnée ? La durée
 * dépend du programme du fil (link_ttl_days), lu en base APRÈS la vérification
 * de signature : d'où une fonction à part de verifyScopedToken.
 */
export function scopedTokenAgeExceeded(issuedAtMs: number, maxAgeMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - issuedAtMs > maxAgeMs;
}
