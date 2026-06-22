import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { promoteWaitlist } from "@/lib/events/register";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Purge les billets 'pending' abandonnés (checkout Stripe non complété).
 * Libère les places et promeut la liste d'attente.
 * Sécurisé par CRON_SECRET. Prévu toutes les heures.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // -1 h

  // Récupère les billets pending expirés pour pouvoir appeler promoteWaitlist
  const { data: expiredTickets } = await admin
    .from("event_tickets")
    .select("id, event_id, registration_id")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff);

  if (!expiredTickets || expiredTickets.length === 0) {
    return NextResponse.json({ ok: true, expired: 0, promoted: 0 });
  }

  // Supprime les billets expired
  const ids = expiredTickets.map((t) => t.id);
  await admin.from("event_tickets").delete().in("id", ids);

  // Pour chaque registration qui n'a plus de billets → annule
  const regIds = [...new Set(expiredTickets.map((t) => t.registration_id).filter(Boolean))];
  for (const regId of regIds) {
    const { count } = await admin
      .from("event_tickets")
      .select("*", { count: "exact", head: true })
      .eq("registration_id", regId);
    if ((count ?? 0) === 0) {
      await admin.from("event_registrations").update({ status: "annule" }).eq("id", regId);
    }
  }

  // Promeut la liste d'attente pour chaque événement affecté
  const eventIds = [...new Set(expiredTickets.map((t) => t.event_id))];
  let promoted = 0;
  for (const eventId of eventIds) {
    promoted += await promoteWaitlist(eventId);
  }

  return NextResponse.json({ ok: true, expired: expiredTickets.length, promoted });
}
