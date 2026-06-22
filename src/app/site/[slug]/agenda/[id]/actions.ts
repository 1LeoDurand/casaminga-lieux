"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { registerForEvent } from "@/lib/events/register";
import { createAdminClient } from "@/lib/admin/guard";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";

export interface RegistrationPayload {
  eventId: string;
  organizationId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  nbPlaces: number;
  participants: { prenom: string; nom: string }[];
  montantTotal: number;
  online?: boolean;
}

export type RegistrationActionResult =
  | { ok: true; id: string; status: "inscrit" | "liste_attente"; redirectUrl?: string }
  | { ok: false; error: string };

/**
 * Inscription depuis le tunnel public du site.
 * Délègue au moteur unique (capacité, liste d'attente, billets, email) —
 * plus aucune insertion directe ici.
 */
export async function createEventRegistration(
  payload: RegistrationPayload
): Promise<RegistrationActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, id: crypto.randomUUID(), status: "inscrit" };
  }

  const participants = (payload.participants ?? [])
    .map((p) => `${p.prenom} ${p.nom}`.trim())
    .filter(Boolean);

  // Détermine le mode de paiement pour gater la livraison des QR
  const willPayOnline = !!(payload.online && payload.montantTotal > 0 && isStripeConfigured());

  const res = await registerForEvent({
    eventId: payload.eventId,
    fullName: `${payload.prenom} ${payload.nom}`.trim(),
    email: payload.email,
    phone: payload.telephone,
    participants,
    source: "public",
    amountTtc: payload.montantTotal,
    paymentMode: willPayOnline ? "online" : payload.montantTotal > 0 ? "onsite" : "free",
  });

  if (!res.ok) return { ok: false, error: res.error };

  // Paiement en ligne (Stripe Connect) si demandé et événement payant
  if (
    payload.online &&
    payload.montantTotal > 0 &&
    res.status === "inscrit" &&
    isStripeConfigured()
  ) {
    const admin = createAdminClient();
    if (admin) {
      const { data: org } = await admin
        .from("organizations")
        .select("slug, name, stripe_account_id, stripe_charges_enabled")
        .eq("id", payload.organizationId)
        .maybeSingle();

      if (org?.stripe_account_id && org.stripe_charges_enabled) {
        const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
        const nbPlaces = payload.nbPlaces ?? 1;
        const label = nbPlaces > 1
          ? `Billets × ${nbPlaces} — ${org.name}`
          : `Billet — ${org.name}`;

        const session = await createCheckoutSession({
          accountId: org.stripe_account_id,
          amountEuros: payload.montantTotal,
          label,
          metadata: { event_registration_id: res.registrationId },
          customerEmail: payload.email,
          successUrl: `${base}/site/${org.slug}/agenda/${payload.eventId}?paiement=ok`,
          cancelUrl: `${base}/site/${org.slug}/agenda/${payload.eventId}?paiement=annule`,
        });

        if (session) {
          return { ok: true, id: res.registrationId, status: res.status, redirectUrl: session.url };
        }
      }
    }
  }

  return { ok: true, id: res.registrationId, status: res.status };
}
