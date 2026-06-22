import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/admin/guard";
import { constructWebhookEvent } from "@/lib/stripe";
import { generatePaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
import { sendMail } from "@/lib/mail";
import { tplPaiementConfirme } from "@/lib/mail-templates";
import { issueTicketsEmail } from "@/lib/events/register";

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
  const adhesionId = session.metadata?.adhesion_id;
  const eventRegistrationId = session.metadata?.event_registration_id;

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

  // ── Adhésion en ligne → confirmée (idempotent) ──
  if (adhesionId) {
    const { data: adhesion } = await admin
      .from("membership_applications")
      .select("id, status")
      .eq("id", adhesionId)
      .maybeSingle();
    if (!adhesion) return NextResponse.json({ ok: true, skipped: true, reason: "adhesion_not_found" });
    if (adhesion.status === "confirmee") return NextResponse.json({ ok: true, skipped: true, reason: "already_confirmed" });

    await admin.from("membership_applications").update({
      status: "confirmee",
      payment_method: "en_ligne",
      payment_ref: session.id,
      updated_at: new Date().toISOString(),
    }).eq("id", adhesion.id);

    // Reçu PDF + email de confirmation
    const { data: fullAdhesion } = await admin
      .from("membership_applications")
      .select("first_name, last_name, email, amount_paid, membership_start, membership_end, tier_id, organization_id")
      .eq("id", adhesion.id)
      .maybeSingle();
    if (fullAdhesion?.email) {
      const { data: org } = await admin.from("organizations").select("name").eq("id", fullAdhesion.organization_id).maybeSingle();
      const { data: tier } = fullAdhesion.tier_id
        ? await admin.from("membership_tiers").select("name").eq("id", fullAdhesion.tier_id).maybeSingle()
        : { data: null };
      const description = tier?.name ? `Adhésion — ${tier.name}` : "Adhésion";
      const receiptData = {
        orgName: org?.name ?? "Casa Minga",
        receiptRef: session.id,
        date: new Date().toISOString(),
        holderName: `${fullAdhesion.first_name} ${fullAdhesion.last_name}`.trim(),
        holderEmail: fullAdhesion.email,
        description,
        amountEuros: amountPaid ?? Number(fullAdhesion.amount_paid),
        paymentMethod: "Carte bancaire (Stripe)",
      };
      try {
        const pdfBuffer = await generatePaymentReceiptPdf(receiptData);
        await sendMail({
          to: fullAdhesion.email,
          subject: `Reçu de paiement — ${org?.name ?? "Casa Minga"}`,
          html: tplPaiementConfirme({
            orgName: receiptData.orgName,
            firstName: fullAdhesion.first_name,
            description,
            amountEuros: receiptData.amountEuros,
            receiptRef: session.id,
            date: receiptData.date,
          }),
          attachments: [{ filename: "recu-paiement.pdf", content: pdfBuffer, contentType: "application/pdf" }],
          category: "recu-paiement",
          organizationId: fullAdhesion.organization_id,
        });
      } catch (e) {
        console.error("[webhook] Erreur génération reçu adhésion:", e);
      }
    }

    return NextResponse.json({ ok: true, adhesion_paid: true });
  }

  // ── Inscription événement → paiement enregistré (idempotent) ──
  if (eventRegistrationId) {
    await admin
      .from("event_registrations")
      .update({
        stripe_session_id: session.id,
        amount_paid: amountPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventRegistrationId);

    // Basculer les billets pending→paid (idempotent : ne touche que les pending)
    const { data: flippedTickets } = await admin
      .from("event_tickets")
      .update({ payment_status: "paid" })
      .eq("registration_id", eventRegistrationId)
      .eq("payment_status", "pending")
      .select("holder_name, ticket_token");

    // Reçu PDF + email de confirmation
    const { data: reg } = await admin
      .from("event_registrations")
      .select("full_name, email, amount_ttc, event_id, organization_id")
      .eq("id", eventRegistrationId)
      .maybeSingle();
    if (reg?.email) {
      const { data: org } = await admin.from("organizations").select("name").eq("id", reg.organization_id).maybeSingle();
      const { data: evt } = await admin.from("evenements").select("title, start_at").eq("id", reg.event_id).maybeSingle();
      const description = evt?.title ? `Billet — ${evt.title}` : "Billet événement";
      const receiptData = {
        orgName: org?.name ?? "Casa Minga",
        receiptRef: session.id,
        date: new Date().toISOString(),
        holderName: reg.full_name,
        holderEmail: reg.email,
        description,
        amountEuros: amountPaid ?? Number(reg.amount_ttc),
        paymentMethod: "Carte bancaire (Stripe)",
      };
      try {
        const pdfBuffer = await generatePaymentReceiptPdf(receiptData);
        await sendMail({
          to: reg.email,
          subject: `Reçu de paiement — ${org?.name ?? "Casa Minga"}`,
          html: tplPaiementConfirme({
            orgName: receiptData.orgName,
            firstName: reg.full_name.split(" ")[0] ?? reg.full_name,
            description,
            amountEuros: receiptData.amountEuros,
            receiptRef: session.id,
            date: receiptData.date,
          }),
          attachments: [{ filename: "recu-paiement.pdf", content: pdfBuffer, contentType: "application/pdf" }],
          category: "recu-paiement",
          organizationId: reg.organization_id,
        });
      } catch (e) {
        console.error("[webhook] Erreur génération reçu événement:", e);
      }

      // Envoyer les QR uniquement si des billets viennent de passer pending→paid
      if (flippedTickets && flippedTickets.length > 0 && evt?.start_at) {
        try {
          await issueTicketsEmail({
            to: reg.email,
            fullName: reg.full_name,
            eventTitle: evt.title,
            startAt: evt.start_at,
            organizationId: reg.organization_id,
            tickets: flippedTickets as { holder_name: string; ticket_token: string }[],
            waiting: false,
            seats: flippedTickets.length,
            subjectPrefix: "Paiement confirmé — vos billets",
          });
        } catch (e) {
          console.error("[webhook] Erreur envoi QR billets:", e);
        }
      }
    }

    return NextResponse.json({ ok: true, event_registration_paid: true });
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
