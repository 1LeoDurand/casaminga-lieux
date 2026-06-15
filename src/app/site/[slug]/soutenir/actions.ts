"use server";

import { createAdminClient } from "@/lib/admin/guard";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { sendMail, adminEmail } from "@/lib/mail";

type SubmitResult =
  | { ok: true; redirectUrl?: string; pledged?: boolean }
  | { ok: false; error: string };

export interface PublicDonationInput {
  slug: string;
  donorName: string;
  donorEmail: string;
  donorAddress: string;
  amount: number;
  campaignId: string | null;
  online: boolean; // le donateur veut payer en ligne maintenant
}

/**
 * Don depuis le site public (page « Soutenir »).
 * Service-role (non authentifié), même modèle que /billet et /adhesion.
 *  - enregistre le don (en_attente) + rattache/​crée la fiche donateur (tag « donateur ») ;
 *  - si Stripe connecté et paiement en ligne demandé → session Checkout (webhook confirmera) ;
 *  - sinon → promesse de don, l'équipe est notifiée et confirmera à réception.
 */
export async function submitPublicDonation(input: PublicDonationInput): Promise<SubmitResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };

  if (!input.donorName.trim()) return { ok: false, error: "Indiquez votre nom." };
  if (!input.amount || input.amount <= 0) return { ok: false, error: "Montant invalide." };

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, stripe_account_id, stripe_charges_enabled")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!org) return { ok: false, error: "Lieu introuvable." };

  // Vérifie la campagne (si fournie) et qu'elle est publique
  let campaignId: string | null = null;
  if (input.campaignId) {
    const { data: camp } = await admin
      .from("donation_campaigns")
      .select("id, is_public, organization_id")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (camp && camp.organization_id === org.id && camp.is_public) campaignId = camp.id;
  }

  // Rattache/crée la fiche donateur (tag « donateur »)
  let personId: string | null = null;
  try {
    const email = input.donorEmail.trim().toLowerCase();
    if (email) {
      const { data: existing } = await admin
        .from("persons")
        .select("id, tags")
        .eq("organization_id", org.id)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (existing) {
        personId = existing.id;
        const tags: string[] = existing.tags ?? [];
        if (!tags.includes("donateur")) {
          await admin.from("persons").update({ tags: [...tags, "donateur"] }).eq("id", existing.id);
        }
      }
    }
    if (!personId) {
      const { data: created } = await admin
        .from("persons")
        .insert({
          organization_id: org.id,
          name: input.donorName.trim(),
          email: input.donorEmail.trim() || null,
          phone: null,
          role: "prospect",
          status: "actif",
          tags: ["donateur"],
          notes: "Don depuis le site public.",
        })
        .select("id")
        .single();
      personId = created?.id ?? null;
    }
  } catch (e) {
    console.error("submitPublicDonation/person:", e);
  }

  // Enregistre le don (en attente de confirmation)
  const { data: donation, error } = await admin
    .from("donations")
    .insert({
      organization_id: org.id,
      donor_name: input.donorName.trim(),
      donor_person_id: personId,
      donor_email: input.donorEmail.trim() || null,
      donor_address: input.donorAddress.trim() || null,
      amount: input.amount,
      donation_type: "ponctuel",
      received_at: new Date().toISOString().slice(0, 10),
      payment_method: input.online ? "en_ligne" : null,
      payment_status: "en_attente",
      campaign_id: campaignId,
    })
    .select("id")
    .single();
  if (error || !donation) return { ok: false, error: "Échec de l'enregistrement du don." };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

  // Paiement en ligne (Stripe Connect) si possible
  if (input.online && isStripeConfigured() && org.stripe_account_id && org.stripe_charges_enabled) {
    const session = await createCheckoutSession({
      accountId: org.stripe_account_id,
      amountEuros: input.amount,
      label: `Don à ${org.name}`,
      metadata: { donation_id: donation.id },
      customerEmail: input.donorEmail.trim() || null,
      successUrl: `${base}/site/${org.slug}/soutenir?don=merci`,
      cancelUrl: `${base}/site/${org.slug}/soutenir?don=annule`,
    });
    if (session) return { ok: true, redirectUrl: session.url };
    // si la session échoue → on retombe sur la promesse de don
  }

  // Promesse de don : notifier l'équipe (best-effort)
  void sendMail({
    to: adminEmail(),
    subject: `Nouveau don — ${org.name}`,
    html: `<p>Nouveau don déclaré sur le site public :</p>
      <ul>
        <li><strong>${input.donorName}</strong>${input.donorEmail ? ` — ${input.donorEmail}` : ""}</li>
        <li>Montant : <strong>${input.amount.toFixed(2)} €</strong></li>
      </ul>
      <p>À confirmer dans le module Dons une fois les fonds reçus.</p>`,
    category: "dons",
    organizationId: org.id,
  });

  return { ok: true, pledged: true };
}
