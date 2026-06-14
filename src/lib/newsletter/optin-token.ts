import "server-only";
import crypto from "node:crypto";

/**
 * Token de confirmation d'inscription newsletter (double opt-in RGPD).
 *
 * Stateless, signé HMAC-SHA256 : aucune table, aucune migration. Seuls les
 * emails CONFIRMÉS (après clic sur le lien) créent une fiche `persons`.
 * Encode (slug du lieu + email). Le secret est dérivé d'une variable serveur
 * existante (PORTAL_LINK_SECRET sinon SUPABASE_SERVICE_ROLE_KEY), donc actif
 * en prod sans nouvelle config. La rotation du secret invalide les liens en
 * attente (acceptable : aucune donnée bancaire, lien re-générable).
 */

function secret(): string | null {
  return process.env.PORTAL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/** Signe un token pour (slug, email). Renvoie null si aucun secret configuré. */
export function signOptinToken(slug: string, email: string): string | null {
  const s = secret();
  if (!s) return null;
  const payload = `${slug}:${normalizeEmail(email)}`;
  const sig = crypto.createHmac("sha256", s).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

/** Vérifie un token. Renvoie { slug, email } si valide, sinon null. */
export function verifyOptinToken(token: string): { slug: string; email: string } | null {
  const s = secret();
  if (!s) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", s).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(parts[1], "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }
  const idx = payload.indexOf(":");
  if (idx < 0) return null;
  const slug = payload.slice(0, idx);
  const email = payload.slice(idx + 1);
  if (!slug || !email) return null;
  return { slug, email };
}
