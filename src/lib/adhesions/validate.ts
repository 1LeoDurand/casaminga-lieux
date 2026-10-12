/**
 * Pure validation for the public membership application intake
 * (POST /api/orgs/[slug]/adhesions/[campaignSlug]).
 * No Supabase, no Next.js: side-effect free, same spirit as
 * src/lib/feedback/validate.ts. Error messages are generic on purpose: the
 * route never echoes what it received.
 */

export const FIRST_NAME_MAX = 100;
export const LAST_NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 30;
export const PAYER_NAME_MAX = 200;
export const DONATION_MAX = 5000;

/** Whole request cap, checked on Content-Length before the JSON is parsed. */
export const MAX_REQUEST_BYTES = 8 * 1024;

export const RATE_LIMIT_PER_IP_PER_HOUR = 10;
export const RATE_LIMIT_PER_EMAIL_PER_HOUR = 3;
export const RATE_WINDOW_MS = 3_600_000;

/** A pending or confirmed application younger than this blocks a new one. */
export const DUPLICATE_WINDOW_DAYS = 30;

/** Simple, deliberately permissive email shape check (no DNS/MX lookup). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdhesionInput {
  first_name: string;
  last_name: string;
  /** Lowercased. */
  email: string;
  phone: string | null;
  tier_id: string;
  payer_name: string | null;
  payer_email: string | null;
  /** Null when no donation; otherwise 0 < x <= DONATION_MAX with two decimals. */
  donation_amount: number | null;
  online: boolean;
}

export type AdhesionValidation =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; data: AdhesionInput }
  | { ok: false; error: string };

/** Trimmed string within max, "" when absent, undefined when of the wrong type or too long. */
function field(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > max ? undefined : t;
}

export function validateAdhesion(raw: Record<string, unknown>): AdhesionValidation {
  // Honeypot: a real visitor never sees the `website` field.
  const hp = raw.website;
  if (typeof hp === "string" ? hp.trim() !== "" : hp !== undefined && hp !== null && hp !== "") {
    return { ok: true, honeypot: true };
  }

  const fail = { ok: false as const, error: "invalid_request" };

  const first_name = field(raw.first_name, FIRST_NAME_MAX);
  const last_name = field(raw.last_name, LAST_NAME_MAX);
  const emailRaw = field(raw.email, EMAIL_MAX);
  const phone = field(raw.phone, PHONE_MAX);
  const payer_name = field(raw.payer_name, PAYER_NAME_MAX);
  const payer_email = field(raw.payer_email, EMAIL_MAX);
  const tier_id = field(raw.tier_id, 64);
  if (
    first_name === undefined || last_name === undefined || emailRaw === undefined ||
    phone === undefined || payer_name === undefined || payer_email === undefined ||
    tier_id === undefined
  ) return fail;

  if (!first_name || !last_name || !tier_id) return fail;
  const email = emailRaw.toLowerCase();
  if (!EMAIL_RE.test(email)) return fail;
  const payerEmailLower = payer_email.toLowerCase();
  if (payerEmailLower && !EMAIL_RE.test(payerEmailLower)) return fail;

  // Donation: absent, null, 0 or "" means none. Anything else must be a clean amount.
  let donation_amount: number | null = null;
  const d = raw.donation_amount;
  if (d !== undefined && d !== null && d !== "" && d !== 0) {
    const n = typeof d === "number" ? d : typeof d === "string" ? Number(d.replace(",", ".")) : NaN;
    if (!Number.isFinite(n) || n <= 0 || n > DONATION_MAX) return fail;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return fail;
    donation_amount = Math.round(n * 100) / 100;
  }

  return {
    ok: true,
    honeypot: false,
    data: {
      first_name,
      last_name,
      email,
      phone: phone || null,
      tier_id,
      payer_name: payer_name || null,
      payer_email: payerEmailLower || null,
      donation_amount,
      online: raw.online === true,
    },
  };
}
