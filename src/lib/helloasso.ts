/**
 * Client HelloAsso API v5
 * Docs : https://api.helloasso.com/v5/swagger/ui/index
 *
 * Flux OAuth2 client_credentials → token valide 30 min.
 * On ne cache pas le token ici (SSR stateless) — le refetch est rapide.
 */

const HA_BASE = "https://api.helloasso.com/v5";
const HA_AUTH = "https://api.helloasso.com";

export interface HelloAssoCredentials {
  clientId: string;
  clientSecret: string;
  orgSlug: string;
}

export interface HelloAssoToken {
  access_token: string;
  expires_in: number;
}

/** Obtient un token OAuth2 client_credentials. */
export async function getHelloAssoToken(creds: HelloAssoCredentials): Promise<HelloAssoToken | null> {
  try {
    const res = await fetch(`${HA_AUTH}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });
    if (!res.ok) {
      console.error("HelloAsso OAuth error", res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (e) {
    console.error("HelloAsso OAuth fetch error", e);
    return null;
  }
}

export interface HelloAssoPayment {
  id: string;
  amount: number; // en centimes
  date: string;
  payer: { email: string; firstName: string; lastName: string };
  items: {
    id: string;
    type: string;
    name: string;
    amount: number;
    tierDescription?: string;
  }[];
  order: { id: string; formSlug: string; formType: string };
}

export interface HelloAssoPaymentsResponse {
  data: HelloAssoPayment[];
  pagination: { totalCount: number; pageSize: number; pageIndex: number };
}

/** Liste les paiements d'une campagne d'adhésion HelloAsso. */
export async function getHelloAssoPayments(
  token: string,
  orgSlug: string,
  formSlug: string,
  pageIndex = 1,
  pageSize = 50
): Promise<HelloAssoPaymentsResponse | null> {
  try {
    const url = new URL(`${HA_BASE}/organizations/${orgSlug}/forms/Membership/${formSlug}/payments`);
    url.searchParams.set("pageIndex", String(pageIndex));
    url.searchParams.set("pageSize", String(pageSize));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error("HelloAsso payments error", res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (e) {
    console.error("HelloAsso payments fetch error", e);
    return null;
  }
}

/** Liste les formulaires d'adhésion d'une organisation. */
export async function getHelloAssoForms(token: string, orgSlug: string) {
  try {
    const res = await fetch(`${HA_BASE}/organizations/${orgSlug}/forms?formType=Membership`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Parse un payload webhook HelloAsso. Retourne null si invalide. */
export function parseHelloAssoWebhook(body: unknown): HelloAssoPayment | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.eventType !== "Payment") return null;
  const data = b.data as Record<string, unknown>;
  if (!data?.id || !data?.payer || !data?.order) return null;
  return data as unknown as HelloAssoPayment;
}
