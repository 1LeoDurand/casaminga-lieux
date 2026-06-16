import { NextResponse } from "next/server";
import {
  createMembershipApplication,
  getOrganizationBySlug,
  getPublicCampaignBySlug,
  getTiersForCampaign,
} from "@/lib/data";
import { computeMembershipEnd } from "@/lib/adhesions-meta";
import { sendMail } from "@/lib/mail";
import { tplAdhesionCandidat } from "@/lib/mail-templates";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; campaignSlug: string }> }
) {
  const { slug, campaignSlug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim() || null;
  const tier_id = String(body.tier_id ?? "").trim() || null;
  const payer_name = String(body.payer_name ?? "").trim() || null;
  const payer_email = String(body.payer_email ?? "").trim() || null;
  const donationRaw = Number(body.donation_amount);
  const donation_amount = Number.isFinite(donationRaw) && donationRaw > 0 ? donationRaw : null;
  const online = body.online === true;

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "Prénom et nom sont requis." }, { status: 400 });
  }
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  if (!tier_id) {
    return NextResponse.json({ error: "Formule manquante." }, { status: 400 });
  }

  const org = await getOrganizationBySlug(slug);
  if (!org) {
    return NextResponse.json({ error: "Lieu introuvable." }, { status: 404 });
  }
  const campaign = await getPublicCampaignBySlug(org.id, campaignSlug);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne d'adhésion indisponible." }, { status: 404 });
  }

  const tiers = await getTiersForCampaign(campaign.id);
  const tier = tiers.find((t) => t.id === tier_id);
  if (!tier) {
    return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
  }

  const membership_start = new Date().toISOString().slice(0, 10);
  const membership_end = computeMembershipEnd(campaign.period_type, membership_start, campaign.period_end);

  const adhesionId = await createMembershipApplication({
    campaign_id: campaign.id,
    tier_id: tier.id,
    organization_id: org.id,
    first_name,
    last_name,
    email,
    phone,
    payer_name: payer_name ?? `${first_name} ${last_name}`,
    payer_email: payer_email ?? email,
    amount_paid: Number(tier.amount) || 0,
    donation_amount,
    status: "en_attente",
    membership_start,
    membership_end,
    notes: null,
    payment_method: online ? "en_ligne" : null,
  });

  if (!adhesionId) {
    return NextResponse.json(
      { error: "L'enregistrement a échoué. Réessayez." },
      { status: 500 }
    );
  }

  const tierAmount = Number(tier.amount) || 0;
  const totalAmount = tierAmount + (donation_amount ?? 0);

  // Paiement en ligne via Stripe Connect (compte du lieu)
  if (online && totalAmount > 0 && isStripeConfigured() && org.stripe_account_id && org.stripe_charges_enabled) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
    const session = await createCheckoutSession({
      accountId: org.stripe_account_id,
      amountEuros: totalAmount,
      label: `Adhésion ${tier.name} — ${org.name}`,
      metadata: { adhesion_id: adhesionId },
      customerEmail: email,
      successUrl: `${base}/site/${org.slug}/adhesion/${campaign.slug}?paiement=ok`,
      cancelUrl: `${base}/site/${org.slug}/adhesion/${campaign.slug}?paiement=annule`,
    });
    if (session) {
      return NextResponse.json({ ok: true, redirectUrl: session.url }, { status: 201 });
    }
    // Si Stripe échoue → on continue sans paiement (best-effort)
  }

  // Confirmation au candidat (paiement offline ou Stripe indisponible)
  void sendMail({
    to: email,
    subject: `✓ Votre candidature d'adhésion — ${org.name}`,
    html: tplAdhesionCandidat({
      orgName: org.name,
      firstName: first_name,
      lastName: last_name,
      tierLabel: tier.name ?? "Adhésion",
      amount: tierAmount,
      membershipEnd: membership_end ?? "",
    }),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
