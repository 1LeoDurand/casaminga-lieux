import { NextResponse } from "next/server";
import {
  createMembershipApplication,
  getOrganizationBySlug,
  getPublicCampaignBySlug,
  getTiersForCampaign,
} from "@/lib/data";
import { computeMembershipEnd } from "@/lib/adhesions-meta";

/**
 * Souscription d'adhésion depuis un tunnel public.
 * POST /api/orgs/[slug]/adhesions/[campaignSlug]
 *
 * Résout l'organisation et la campagne publiée depuis les slugs, valide la
 * formule choisie, calcule les dates de validité d'après la période de la
 * campagne, puis insère une ligne dans `membership_applications`
 * (status 'en_attente', à confirmer côté admin).
 * Aucune clé service_role : Supabase est appelé côté serveur via le client
 * anon, l'insertion publique est autorisée par la policy RLS
 * `ma_public_insert` (campagne « publie »). Fallback démo sinon.
 */
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

  const ok = await createMembershipApplication({
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
  });

  if (!ok) {
    return NextResponse.json(
      { error: "L'enregistrement a échoué. Réessayez." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
