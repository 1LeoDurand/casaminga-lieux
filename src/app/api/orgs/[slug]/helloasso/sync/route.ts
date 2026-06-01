import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug, getMembershipCampaignsForOrg, getTiersForCampaign, createMembershipApplication } from "@/lib/data";
import { getHelloAssoToken, getHelloAssoPayments } from "@/lib/helloasso";
import { computeMembershipEnd } from "@/lib/adhesions-meta";

/**
 * Import manuel HelloAsso — POST /api/orgs/[slug]/helloasso/sync
 * Body : { form_slug: string }
 *
 * Importe l'historique des paiements d'un formulaire HelloAsso
 * vers les adhésions Casa Minga. Idempotent (skip si déjà importé).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: Record<string, string>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const formSlug = String(body.form_slug ?? "").trim();
  if (!formSlug) return NextResponse.json({ error: "form_slug requis" }, { status: 400 });

  const org = await getOrganizationBySlug(slug);
  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  const supabase = await createClient();

  // Récupérer les credentials HelloAsso depuis l'org
  const { data: orgFull } = await supabase
    .from("organizations")
    .select("helloasso_client_id, helloasso_client_secret, helloasso_org_slug")
    .eq("id", org.id)
    .single();

  if (!orgFull?.helloasso_client_id || !orgFull?.helloasso_client_secret || !orgFull?.helloasso_org_slug) {
    return NextResponse.json({ error: "HelloAsso non configuré pour ce lieu." }, { status: 400 });
  }

  const token = await getHelloAssoToken({
    clientId: orgFull.helloasso_client_id,
    clientSecret: orgFull.helloasso_client_secret,
    orgSlug: orgFull.helloasso_org_slug,
  });
  if (!token) return NextResponse.json({ error: "Authentification HelloAsso échouée." }, { status: 401 });

  const paymentsRes = await getHelloAssoPayments(token.access_token, orgFull.helloasso_org_slug, formSlug);
  if (!paymentsRes) return NextResponse.json({ error: "Impossible de récupérer les paiements." }, { status: 502 });

  const campaigns = await getMembershipCampaignsForOrg(org.id);
  const campaign = campaigns.find((c) => c.slug === formSlug || c.slug.includes(formSlug) || formSlug.includes(c.slug))
    ?? campaigns.find((c) => c.status === "publie") ?? null;

  if (!campaign) return NextResponse.json({ error: "Aucune campagne correspondante trouvée." }, { status: 404 });

  const tiers = await getTiersForCampaign(campaign.id);
  let imported = 0;
  let skipped = 0;

  for (const payment of paymentsRes.data) {
    // Idempotence
    const { data: existing } = await supabase
      .from("membership_applications")
      .select("id")
      .eq("organization_id", org.id)
      .eq("notes", `helloasso:${payment.id}`)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const amountEuros = payment.amount / 100;
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
      status: "confirmee",
      membership_start,
      membership_end,
      notes: `helloasso:${payment.id}`,
      payment_method: "helloasso",
      payment_ref: payment.order.id,
    });

    if (ok) imported++; else skipped++;
  }

  await supabase.from("helloasso_sync_log").insert({
    organization_id: org.id,
    event_type: "manual_sync",
    helloasso_form_slug: formSlug,
    status: "ok",
    details: { imported, skipped, total: paymentsRes.data.length },
  });

  return NextResponse.json({ ok: true, imported, skipped, total: paymentsRes.data.length });
}
