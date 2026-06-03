import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rappels automatiques :
 *  - Réservations confirmées qui débutent DEMAIN (J-1) → email au contact.
 *  - Adhésions confirmées dont la fin tombe dans 30 jours (J-30) → rappel de renouvellement.
 * Sécurisé par CRON_SECRET. Conçu pour tourner 1×/jour (fenêtres datées → pas de doublon).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const [{ sendMail }, { tplReservationRappel, tplAdhesionRappelRenouvellement }] = await Promise.all([
    import("@/lib/mail"),
    import("@/lib/mail-templates"),
  ]);

  // ── Fenêtre J-1 (demain 00:00 → 23:59) ──
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayStart = new Date(tomorrow); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(tomorrow); dayEnd.setHours(23, 59, 59, 999);

  let resaSent = 0;
  const { data: resas } = await admin
    .from("reservations")
    .select("id, title, start_at, end_at, status, persons(name, email), spaces(name), organizations(name)")
    .eq("status", "confirmee")
    .gte("start_at", dayStart.toISOString())
    .lte("start_at", dayEnd.toISOString());

  for (const r of (resas ?? []) as unknown as Array<{
    title: string | null; start_at: string; end_at: string;
    persons: { name: string; email: string | null } | null;
    spaces: { name: string } | null;
    organizations: { name: string } | null;
  }>) {
    const email = r.persons?.email;
    if (!email) continue;
    const ok = await sendMail({
      to: email,
      subject: `Rappel — votre réservation demain · ${r.organizations?.name ?? "Casa Minga"}`,
      html: tplReservationRappel({
        orgName: r.organizations?.name ?? "Casa Minga Lieux",
        contactName: r.persons?.name ?? "",
        spaceName: r.spaces?.name ?? r.title ?? "Espace",
        startAt: r.start_at,
        endAt: r.end_at,
      }),
    });
    if (ok) resaSent++;
  }

  // ── Adhésions J-30 (fin d'adhésion dans exactement 30 jours) ──
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Date = in30.toISOString().slice(0, 10);

  let adhSent = 0;
  const { data: apps } = await admin
    .from("membership_applications")
    .select("id, first_name, email, membership_end, status, organizations(name)")
    .eq("status", "confirmee")
    .eq("membership_end", in30Date);

  for (const a of (apps ?? []) as unknown as Array<{
    first_name: string; email: string | null; membership_end: string;
    organizations: { name: string } | null;
  }>) {
    if (!a.email) continue;
    const ok = await sendMail({
      to: a.email,
      subject: `Votre adhésion arrive à échéance · ${a.organizations?.name ?? "Casa Minga"}`,
      html: tplAdhesionRappelRenouvellement({
        orgName: a.organizations?.name ?? "Casa Minga Lieux",
        firstName: a.first_name,
        membershipEnd: new Date(a.membership_end).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
      }),
    });
    if (ok) adhSent++;
  }

  return NextResponse.json({ ok: true, reservationsReminded: resaSent, adhesionsReminded: adhSent });
}
