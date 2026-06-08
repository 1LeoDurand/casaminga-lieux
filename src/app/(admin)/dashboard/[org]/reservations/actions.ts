"use server";

import { revalidatePath } from "next/cache";
import {
  createReservation,
  deleteReservation,
  updateReservation,
  type ReservationInput,
  type ReservationWriteResult,
} from "@/lib/data";
import { sendMail } from "@/lib/mail";
import {
  tplReservationConfirmee,
  tplReservationApprouvee,
  tplReservationAnnulee,
  tplLienPaiement,
} from "@/lib/mail-templates";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/reservations`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

/** Métadonnées email passées séparément (ne font pas partie de ReservationInput). */
export interface ReservationMailMeta {
  orgName?: string;
  contactEmail?: string;
  contactName?: string;
  spaceName?: string;
}

export async function createReservationAction(
  orgSlug: string,
  input: ReservationInput,
  mail?: ReservationMailMeta
): Promise<ReservationWriteResult> {
  const res = await createReservation(input);
  if (res.ok && mail?.contactEmail) {
    refresh(orgSlug);
    void sendMail({
      to: mail.contactEmail,
      subject: `✓ Réservation enregistrée — ${mail.orgName ?? orgSlug}`,
      html: tplReservationConfirmee({
        orgName: mail.orgName ?? orgSlug,
        contactName: mail.contactName ?? "Madame/Monsieur",
        spaceName: mail.spaceName ?? "Espace",
        startAt: input.start_at,
        endAt: input.end_at,
        purpose: input.title ?? undefined,
      }),
    });
  } else if (res.ok) {
    refresh(orgSlug);
  }
  return res;
}

export async function updateReservationAction(
  orgSlug: string,
  id: string,
  patch: Partial<ReservationInput>,
  mail?: ReservationMailMeta & { startAt?: string; endAt?: string }
): Promise<ReservationWriteResult> {
  const res = await updateReservation(id, patch);
  if (res.ok) {
    refresh(orgSlug);

    if (patch.status === "confirmee" && mail?.contactEmail) {
      void sendMail({
        to: mail.contactEmail,
        subject: `✓ Réservation confirmée — ${mail.orgName ?? orgSlug}`,
        html: tplReservationApprouvee({
          orgName: mail.orgName ?? orgSlug,
          contactName: mail.contactName ?? "Madame/Monsieur",
          spaceName: mail.spaceName ?? "Espace",
          startAt: mail.startAt ?? "",
          endAt: mail.endAt ?? "",
        }),
      });
    }

    if (patch.status === "annulee" && mail?.contactEmail) {
      void sendMail({
        to: mail.contactEmail,
        subject: `Réservation annulée — ${mail.orgName ?? orgSlug}`,
        html: tplReservationAnnulee({
          orgName: mail.orgName ?? orgSlug,
          contactName: mail.contactName ?? "Madame/Monsieur",
          spaceName: mail.spaceName ?? "Espace",
          startAt: mail.startAt ?? "",
        }),
      });
    }
  }
  return res;
}

export async function deleteReservationAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deleteReservation(id);
  if (ok) refresh(orgSlug);
  return { ok };
}

/**
 * Crée un lien de paiement Stripe pour une réservation et l'envoie au réservant.
 * Lot A : encaissement sur réservation confirmée (Stripe Connect, sans commission).
 */
export async function sendReservationPaymentLinkAction(
  orgSlug: string,
  reservationId: string
): Promise<{ ok: boolean; error?: string; url?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service non configuré." };
  if (!isStripeConfigured()) return { ok: false, error: "Stripe n'est pas configuré sur la plateforme." };

  const supabase = await createClient();

  const { data: resa } = await supabase
    .from("reservations")
    .select("id, title, price, start_at, status, payment_status, person_id, space_id, organization_id")
    .eq("id", reservationId)
    .single();
  if (!resa) return { ok: false, error: "Réservation introuvable." };
  if (resa.payment_status === "paid") return { ok: false, error: "Cette réservation est déjà payée." };
  if (!resa.price || Number(resa.price) <= 0) return { ok: false, error: "Renseignez d'abord un prix sur la réservation." };

  const { data: org } = await supabase
    .from("organizations")
    .select("name, stripe_account_id, stripe_charges_enabled")
    .eq("id", resa.organization_id)
    .single();
  if (!org?.stripe_account_id || !org.stripe_charges_enabled) {
    return { ok: false, error: "Connectez d'abord Stripe dans les Paramètres pour encaisser en ligne." };
  }

  const [{ data: space }, { data: person }] = await Promise.all([
    supabase.from("spaces").select("name").eq("id", resa.space_id).maybeSingle(),
    resa.person_id
      ? supabase.from("persons").select("name, email").eq("id", resa.person_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const label = resa.title || `Réservation — ${space?.name ?? "espace"}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

  const session = await createCheckoutSession({
    accountId: org.stripe_account_id,
    amountEuros: Number(resa.price),
    label,
    reservationId: resa.id,
    customerEmail: person?.email ?? null,
    successUrl: `${base}/dashboard/${orgSlug}/reservations?paid=1`,
    cancelUrl: `${base}/dashboard/${orgSlug}/reservations?paycancel=1`,
  });
  if (!session) return { ok: false, error: "Impossible de créer la session de paiement." };

  await supabase
    .from("reservations")
    .update({ payment_status: "pending", stripe_session_id: session.id })
    .eq("id", resa.id);

  // Envoi du lien par email si le réservant a une adresse
  if (person?.email) {
    void sendMail({
      to: person.email,
      subject: `Lien de paiement — ${org.name}`,
      html: tplLienPaiement({
        orgName: org.name,
        contactName: person.name ?? "Madame/Monsieur",
        label,
        amount: Number(resa.price),
        startAt: resa.start_at,
        payUrl: session.url,
      }),
      category: "paiement",
      organizationId: resa.organization_id,
    });
  }

  refresh(orgSlug);
  return { ok: true, url: session.url };
}
