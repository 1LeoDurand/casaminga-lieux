"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { registerForEvent } from "@/lib/events/register";
import { createAdminClient } from "@/lib/admin/guard";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { isUnclaimedImport } from "@/lib/data";

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

  // Un lieu moissonné et non revendiqué ne reçoit pas d'inscription par Casa
  // Minga : il n'a rien demandé et ne la verrait jamais. Sa page est déjà en
  // 404, mais une action serveur reste appelable directement, avec n'importe
  // quel identifiant : la garde doit aussi vivre ici. Le contrôle du lieu
  // empêche au passage d'associer un événement à l'organisation d'un autre.
  const garde = createAdminClient();
  if (garde) {
    const { data: ev } = await garde
      .from("evenements")
      .select("organization_id, organizations(source, claimed_at)")
      .eq("id", payload.eventId)
      .maybeSingle();
    const org = ev
      ? Array.isArray(ev.organizations) ? ev.organizations[0] : ev.organizations
      : null;
    if (!ev || ev.organization_id !== payload.organizationId || isUnclaimedImport(org as object | null)) {
      return { ok: false, error: "Cet événement n'accepte pas d'inscription ici." };
    }
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
