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
  const donationId = session.metadata?.donation_id;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service indisponible" }, { status: 500 });

  const amountPaid = typeof session.amount_total === "number" ? session.amount_total / 100 : null;

  // ── Don en ligne → confirme + recette auto (idempotent) ──
  if (donationId) {
    const { data: don } = await admin
      .from("donations")
      .select("id, organization_id, donor_name, donor_person_id, amount, received_at, pole_id, payment_status")
      .eq("id", donationId)
      .maybeSingle();
    if (!don) return NextResponse.json({ ok: true, skipped: true, reason: "donation_not_found" });
    if (don.payment_status === "confirme") return NextResponse.json({ ok: true, skipped: true, reason: "already_confirmed" });

    await admin.from("donations").update({
      payment_status: "confirme",
      payment_method: "en_ligne",
      updated_at: new Date().toISOString(),
    }).eq("id", don.id);

    // Recette auto (dédoublonnage par donation_id)
    const { count } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("donation_id", don.id);
    if ((count ?? 0) === 0) {
      let category = "Dons";
      if (don.pole_id) {
        const { data: pole } = await admin.from("poles").select("name").eq("id", don.pole_id).maybeSingle();
        if (pole?.name) category = pole.name;
      }
      await admin.from("transactions").insert({
        organization_id: don.organization_id,
        type: "recette",
        category,
        amount: amountPaid ?? Number(don.amount),
        date: don.received_at,
        label: `Don de ${don.donor_name}`,
        status: "validee",
        person_id: don.donor_person_id ?? null,
        donation_id: don.id,
      });
    }
    return NextResponse.json({ ok: true, donation_paid: true });
  }

  // ── Réservation → payée (idempotent) ──
  if (!reservationId) return NextResponse.json({ ok: true, skipped: true, reason: "no_metadata" });

  const { data: resa } = await admin
    .from("reservations")
    .select("id, payment_status")
    .eq("id", reservationId)
    .maybeSingle();
  if (!resa) return NextResponse.json({ ok: true, skipped: true, reason: "not_found" });
  if (resa.payment_status === "paid") return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });

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
