/**
 * Stripe Connect (Standard) — encaissement des réservations par chaque lieu.
 *
 * Modèle : chaque organisation connecte SON compte Stripe. Les paiements vont
 * directement au lieu (direct charges), Casa Minga ne prélève aucune commission
 * (pas d'application_fee). Casa Minga reste plateforme technique, jamais
 * détentrice des fonds.
 *
 * Variables d'environnement (plateforme) requises dans .env.local :
 *   STRIPE_SECRET_KEY=sk_live_...        (clé secrète du compte plateforme Casa Minga)
 *   STRIPE_WEBHOOK_SECRET=whsec_...      (signature de l'endpoint webhook Connect)
 */

import Stripe from "stripe";

/** Client Stripe plateforme. Null si la clé n'est pas configurée. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Crée un compte connecté Standard pour une organisation. Retourne son id. */
export async function createConnectedAccount(email: string | null): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  const account = await stripe.accounts.create({
    type: "standard",
    email: email ?? undefined,
    metadata: { product: "casa-minga-lieux" },
  });
  return account.id;
}

/** Lien d'onboarding Stripe hébergé (le lieu saisit ses infos chez Stripe). */
export async function createOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Vrai si le compte connecté peut encaisser (onboarding terminé). */
export async function accountChargesEnabled(accountId: string): Promise<boolean> {
  const stripe = stripeClient();
  if (!stripe) return false;
  try {
    const acc = await stripe.accounts.retrieve(accountId);
    return acc.charges_enabled === true;
  } catch {
    return false;
  }
}

/**
 * Crée une session Checkout sur le compte connecté du lieu (direct charge).
 * Montant en euros → converti en centimes. Aucune commission plateforme.
 */
export async function createCheckoutSession(opts: {
  accountId: string;
  amountEuros: number;
  label: string;
  /** Réservation à régler (rétro-compat). Pour les autres usages, passer `metadata`. */
  reservationId?: string;
  /** Métadonnées additionnelles (ex. { donation_id }). Lues par le webhook. */
  metadata?: Record<string, string>;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string } | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  const metadata: Record<string, string> = { product: "casa-minga-lieux", ...(opts.metadata ?? {}) };
  if (opts.reservationId) metadata.reservation_id = opts.reservationId;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(opts.amountEuros * 100),
            product_data: { name: opts.label },
          },
        },
      ],
      customer_email: opts.customerEmail ?? undefined,
      metadata,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    },
    { stripeAccount: opts.accountId }
  );
  if (!session.url) return null;
  return { id: session.id, url: session.url };
}

/** Vérifie la signature d'un webhook Stripe et retourne l'événement, sinon null. */
export function constructWebhookEvent(rawBody: string, signature: string | null): Stripe.Event | null {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) return null;
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("[stripe] signature webhook invalide:", e);
    return null;
  }
}
