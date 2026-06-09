/**
 * Magic-link stateless HMAC-SHA256 pour le portail adhérent.
 *
 * Format : base64url(email) + "." + base64url(HMAC_SHA256(email_normalisé, SECRET))
 *
 * - Pas de stockage DB (stateless) — aucune migration requise.
 * - Révocation globale : changer PORTAL_LINK_SECRET.
 * - Fail-closed : sans secret, sign lève une erreur, verify retourne null.
 * - Timing-safe : crypto.timingSafeEqual évite les attaques par timing.
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.PORTAL_LINK_SECRET ?? "";

/** Normalise un email pour la signature et les lookups : trim + lowercase. */
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

function hmac(email: string): Buffer {
  return createHmac("sha256", SECRET).update(email).digest();
}

/**
 * Signe un email et retourne un token URL-safe.
 * Lève une erreur si PORTAL_LINK_SECRET n'est pas défini.
 */
export function signPortalToken(email: string): string {
  if (!SECRET) {
    throw new Error("PORTAL_LINK_SECRET is not set — cannot sign portal token");
  }
  const normalized = normalizeEmail(email);
  const emailPart = base64url(normalized);
  const sigPart = base64url(hmac(normalized));
  return `${emailPart}.${sigPart}`;
}

/**
 * Vérifie un token.
 * Retourne l'email normalisé si le token est valide, null sinon.
 */
export function verifyPortalToken(token: string): string | null {
  if (!SECRET) return null;
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return null;
    const emailPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    const email = fromBase64url(emailPart);
    const expectedSig = hmac(normalizeEmail(email));
    const actualSig = Buffer.from(sigPart, "base64url");
    if (expectedSig.length !== actualSig.length) return null;
    if (!timingSafeEqual(expectedSig, actualSig)) return null;
    return normalizeEmail(email);
  } catch {
    return null;
  }
}
