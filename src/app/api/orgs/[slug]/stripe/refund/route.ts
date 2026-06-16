import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug } from "@/lib/data";
import { isSuperAdminEmail, createAdminClient } from "@/lib/admin/guard";
import { isStripeConfigured } from "@/lib/stripe";
import Stripe from "stripe";

/**
 * POST /api/orgs/[slug]/stripe/refund
 * Body: { type: "adhesion" | "event_registration", id: string }
 * Remboursement Stripe d'un paiement confirmé. Réservé aux admins de l'org.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const org = await getOrganizationBySlug(slug);
  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  // Auth : membre admin ou super-admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!isSuperAdminEmail(user.email)) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .eq("status", "actif")
      .maybeSingle();
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  if (!org.stripe_account_id) {
    return NextResponse.json({ error: "Compte Stripe non connecté" }, { status: 400 });
  }

  const body = await request.json() as { type?: string; id?: string };
  const { type, id } = body;
  if (!type || !id) {
    return NextResponse.json({ error: "type et id requis" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service indisponible" }, { status: 500 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  if (type === "adhesion") {
    const { data: adhesion } = await admin
      .from("membership_applications")
      .select("id, status, payment_method, payment_ref, amount_paid")
      .eq("id", id)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (!adhesion) return NextResponse.json({ error: "Adhésion introuvable" }, { status: 404 });
    if (adhesion.payment_method !== "en_ligne" || !adhesion.payment_ref) {
      return NextResponse.json({ error: "Aucun paiement en ligne à rembourser" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(
      adhesion.payment_ref,
      {},
      { stripeAccount: org.stripe_account_id }
    );
    if (!session.payment_intent) {
      return NextResponse.json({ error: "Aucun payment_intent trouvé" }, { status: 400 });
    }

    const refund = await stripe.refunds.create(
      { payment_intent: session.payment_intent as string },
      { stripeAccount: org.stripe_account_id }
    );

    await admin.from("membership_applications").update({
      status: "annulee",
      payment_method: "rembourse",
      updated_at: new Date().toISOString(),
    }).eq("id", adhesion.id);

    return NextResponse.json({ ok: true, refund_id: refund.id, amount: (refund.amount ?? 0) / 100 });
  }

  if (type === "event_registration") {
    const { data: reg } = await admin
      .from("event_registrations")
      .select("id, stripe_session_id, amount_paid")
      .eq("id", id)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (!reg) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 });
    if (!reg.stripe_session_id) {
      return NextResponse.json({ error: "Aucun paiement en ligne à rembourser" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(
      reg.stripe_session_id,
      {},
      { stripeAccount: org.stripe_account_id }
    );
    if (!session.payment_intent) {
      return NextResponse.json({ error: "Aucun payment_intent trouvé" }, { status: 400 });
    }

    const refund = await stripe.refunds.create(
      { payment_intent: session.payment_intent as string },
      { stripeAccount: org.stripe_account_id }
    );

    await admin.from("event_registrations").update({
      stripe_refund_id: refund.id,
      updated_at: new Date().toISOString(),
    }).eq("id", reg.id);

    return NextResponse.json({ ok: true, refund_id: refund.id, amount: (refund.amount ?? 0) / 100 });
  }

  return NextResponse.json({ error: "type invalide" }, { status: 400 });
}
