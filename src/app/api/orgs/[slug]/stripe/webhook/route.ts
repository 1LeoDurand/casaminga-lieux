import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/admin/guard";
import { constructWebhookEvent } from "@/lib/stripe";

/**
 * Webhook Stripe Connect — POST /api/orgs/[slug]/stripe/webhook
 *
 * À configurer dans Stripe : Développeurs → Webhooks → endpoint « Connect »
 * URL : https://admin.casaminga.com/api/orgs/{slug}/stripe/webhook
 * Événement : checkout.session.completed
 *
 * On vérifie la signature (STRIPE_WEBHOOK_SECRET) puis on marque la réservation
 * comme payée. Service-role car non authentifié.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = constructWebhookEvent(rawBody, signature);
  if (!event) return NextResponse.json({ error: "signature invalide" }, { status: 400 });

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const reservationId = session.metadata?.reservation_id;
  if (!reservationId) return NextResponse.json({ ok: true, skipped: true, reason: "no_metadata" });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service indisponible" }, { status: 500 });

  // Idempotent : ne repasse pas une réservation déjà payée
  const { data: resa } = await admin
    .from("reservations")
    .select("id, payment_status")
    .eq("id", reservationId)
    .maybeSingle();
  if (!resa) return NextResponse.json({ ok: true, skipped: true, reason: "not_found" });
  if (resa.payment_status === "paid") return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });

  const amountPaid = typeof session.amount_total === "number" ? session.amount_total / 100 : null;
  await admin
    .from("reservations")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid: amountPaid,
      stripe_session_id: session.id,
      status: "confirmee",
    })
    .eq("id", reservationId);

  return NextResponse.json({ ok: true, paid: true });
}
