import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug, createMembershipApplication, getTiersForCampaign, getMembershipCampaignsForOrg } from "@/lib/data";
import { parseHelloAssoWebhook } from "@/lib/helloasso";
import { computeMembershipEnd } from "@/lib/adhesions-meta";

/**
 * Webhook HelloAsso — POST /api/orgs/[slug]/helloasso/webhook
 *
 * HelloAsso envoie un POST JSON à cette URL à chaque paiement.
 * On mappe le paiement vers une MembershipApplication Casa Minga.
 *
 * Configuration dans HelloAsso :
 *   Tableau de bord → API → Notifications → Ajouter une URL
 *   URL : https://admin.casaminga.com/api/orgs/{slug}/helloasso/webhook
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment = parseHelloAssoWebhook(body);
  if (!payment) {
    // Pas un événement Payment — on répond 200 pour éviter les retries HelloAsso
    return NextResponse.json({ ok: true, skipped: true });
  }

  const org = await getOrganizationBySlug(slug);
  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  const supabase = await createClient();

  // Log de réception
  await supabase.from("helloasso_sync_log").insert({
    organization_id: org.id,
    event_type: "webhook_payment",
    helloasso_payment_id: payment.id,
    helloasso_form_slug: payment.order?.formSlug ?? null,
    status: "ok",
    details: body,
  });

  // Trouver la campagne correspondante (matching par slug du formulaire HelloAsso)
  const campaigns = await getMembershipCampaignsForOrg(org.id);
  const formSlug = payment.order?.formSlug ?? "";
  // On cherche une campagne dont le slug contient le form slug HelloAsso
  const campaign = campaigns.find(
    (c) => c.slug === formSlug || c.slug.includes(formSlug) || formSlug.includes(c.slug)
  ) ?? campaigns.find((c) => c.status === "publie") ?? null;

  if (!campaign) {
    await supabase.from("helloasso_sync_log").insert({
      organization_id: org.id,
      event_type: "webhook_no_campaign",
      helloasso_payment_id: payment.id,
      helloasso_form_slug: formSlug,
      status: "skipped",
      details: { reason: "No matching campaign found" },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "no_campaign" });
  }

  // Vérifier si déjà importé (idempotence)
  const { data: existing } = await supabase
    .from("membership_applications")
    .select("id")
    .eq("organization_id", org.id)
    .eq("notes", `helloasso:${payment.id}`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_imported" });
  }

  // Trouver le tier (par montant)
  const amountEuros = payment.amount / 100;
  const tiers = await getTiersForCampaign(campaign.id);
  const tier = tiers.find((t) => Math.abs(Number(t.amount) - amountEuros) < 0.01) ?? tiers[0] ?? null;

  const membership_start = payment.date.slice(0, 10);
  const membership_end = computeMembershipEnd(campaign.period_type, membership_start, campaign.period_end);

  const ok = await createMembershipApplication({
    campaign_id: campaign.id,
    tier_id: tier?.id ?? null,
    organization_id: org.id,
    first_name: payment.payer.firstName,
    last_name: payment.payer.lastName,
    email: payment.payer.email,
    phone: null,
    payer_name: `${payment.payer.firstName} ${payment.payer.lastName}`,
    payer_email: payment.payer.email,
    amount_paid: amountEuros,
    donation_amount: null,
    status: "confirmee", // paiement validé par HelloAsso = confirmée directement
    membership_start,
    membership_end,
    notes: `helloasso:${payment.id}`,
    payment_method: "helloasso",
    payment_ref: payment.order.id,
  });

  if (!ok) {
    await supabase.from("helloasso_sync_log").insert({
      organization_id: org.id,
      event_type: "webhook_insert_failed",
      helloasso_payment_id: payment.id,
      status: "error",
      details: { reason: "createMembershipApplication failed" },
    });
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: true });
}
