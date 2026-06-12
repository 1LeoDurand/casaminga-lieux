import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * RGPD — minimisation et limitation de conservation (art. 5.1.c et 5.1.e).
 * Politique de rétention appliquée automatiquement (1×/jour suffit) :
 *
 *  - email_log            > 12 mois  → suppression (traçabilité technique)
 *  - incoming_requests    > 24 mois (refusées/archivées) → anonymisation
 *  - event_registrations  > 24 mois (événement passé)    → anonymisation
 *    (+ holder_name des billets correspondants)
 *
 * Jamais touchés : factures, écritures de caisse, transactions (conservation
 * légale comptable), adhésions actives, fiches persons (anonymisation à la
 * demande uniquement — c'est une décision humaine).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const now = new Date();
  const days90 = new Date(now); days90.setDate(days90.getDate() - 90);
  const months12 = new Date(now); months12.setMonth(months12.getMonth() - 12);
  const months24 = new Date(now); months24.setMonth(months24.getMonth() - 24);

  // 0. Logs webhooks HelloAsso > 90 jours (contiennent noms/emails/montants)
  const { count: helloassoPurged } = await admin
    .from("helloasso_sync_log")
    .delete({ count: "exact" })
    .lt("created_at", days90.toISOString());

  // 1. Journal email > 12 mois
  const { count: emailLogPurged } = await admin
    .from("email_log")
    .delete({ count: "exact" })
    .lt("created_at", months12.toISOString());

  // 2. Demandes closes > 24 mois → anonymisation (la trace statistique reste)
  const { count: requestsAnonymized } = await admin
    .from("incoming_requests")
    .update({
      name: "Anonyme RGPD", email: null, phone: null,
      organization_ext: null, summary: null, message: null,
    }, { count: "exact" })
    .in("status", ["refusee", "archivee"])
    .lt("received_at", months24.toISOString())
    .neq("name", "Anonyme RGPD");

  // 3. Inscriptions à des événements passés depuis > 24 mois
  const { data: oldEvents } = await admin
    .from("evenements")
    .select("id")
    .lt("start_at", months24.toISOString());

  let regsAnonymized = 0;
  if (oldEvents?.length) {
    const eventIds = oldEvents.map((e) => e.id);
    const { data: regs } = await admin
      .from("event_registrations")
      .select("id")
      .in("event_id", eventIds)
      .neq("full_name", "Anonyme RGPD");
    if (regs?.length) {
      const regIds = regs.map((r) => r.id);
      const { count } = await admin
        .from("event_registrations")
        .update({
          full_name: "Anonyme RGPD", email: "anonyme@rgpd.invalid", phone: null, notes: null,
        }, { count: "exact" })
        .in("id", regIds);
      regsAnonymized = count ?? 0;
      await admin
        .from("event_tickets")
        .update({ holder_name: "Anonyme RGPD" })
        .in("registration_id", regIds);
    }
  }

  const total = (helloassoPurged ?? 0) + (emailLogPurged ?? 0) + (requestsAnonymized ?? 0) + regsAnonymized;
  await logCronRun("rgpd-purge", "ok", { rowsAffected: total });
  return NextResponse.json({
    ok: true,
    helloassoLogPurged: helloassoPurged ?? 0,
    emailLogPurged: emailLogPurged ?? 0,
    requestsAnonymized: requestsAnonymized ?? 0,
    eventRegistrationsAnonymized: regsAnonymized,
  });
}
