import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { logCronRun } from "@/lib/cron-logger";
import { portalActionUrl } from "@/lib/portal/notify";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rappels automatiques :
 *  - Réservations confirmées qui débutent DEMAIN (J-1) → email au contact.
 *  - Adhésions confirmées dont la fin tombe dans 30 jours (J-30) → rappel de renouvellement.
 *  - Billetterie J-1 → rappel aux inscrits.
 * Sécurisé par CRON_SECRET. Conçu pour tourner 1×/jour (fenêtres datées → pas de doublon).
 *
 * Règle « emails actionnables » (CLAUDE.md) : chaque rappel embarque le lien qui
 * permet au destinataire d'agir sans compte — annuler sa place, dire qu'il ne
 * renouvelle pas. Sans PORTAL_LINK_SECRET, portalActionUrl renvoie null et
 * l'email part simplement sans le bouton.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const [{ sendMail }, { tplReservationRappel, tplAdhesionRappelRenouvellement, tplEvenementRappel }] = await Promise.all([
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
    id: string; title: string | null; start_at: string; end_at: string;
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
        cancelUrl: portalActionUrl(email, `reservation/${r.id}`),
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
    .select("id, first_name, email, membership_end, status, organization_id, organizations(name, slug)")
    .eq("status", "confirmee")
    .eq("membership_end", in30Date)
    // Intention déjà déclarée depuis un rappel précédent → on n'insiste pas.
    .is("renewal_intent_at", null);

  // Campagne publiée par org → URL de renouvellement du tunnel d'adhésion.
  const adhOrgIds = [...new Set((apps ?? []).map((a) => a.organization_id as string))];
  const campaignSlugByOrg = new Map<string, string>();
  if (adhOrgIds.length > 0) {
    const { data: campaigns } = await admin
      .from("membership_campaigns")
      .select("slug, organization_id")
      .in("organization_id", adhOrgIds)
      .eq("status", "publie");
    for (const c of campaigns ?? []) {
      if (!campaignSlugByOrg.has(c.organization_id)) campaignSlugByOrg.set(c.organization_id, c.slug);
    }
  }

  for (const a of (apps ?? []) as unknown as Array<{
    id: string; first_name: string; email: string | null; membership_end: string;
    organization_id: string;
    organizations: { name: string; slug: string } | null;
  }>) {
    if (!a.email) continue;
    const campaignSlug = campaignSlugByOrg.get(a.organization_id);
    const ok = await sendMail({
      to: a.email,
      subject: `Votre adhésion arrive à échéance · ${a.organizations?.name ?? "Casa Minga"}`,
      html: tplAdhesionRappelRenouvellement({
        orgName: a.organizations?.name ?? "Casa Minga Lieux",
        firstName: a.first_name,
        membershipEnd: new Date(a.membership_end).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
        renewUrl:
          a.organizations?.slug && campaignSlug
            ? `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/${a.organizations.slug}/adhesion/${campaignSlug}`
            : undefined,
        declineUrl: portalActionUrl(a.email, `adhesion/${a.id}`),
      }),
    });
    if (ok) adhSent++;
  }

  // ── Billetterie J-1 : inscrits aux événements qui commencent demain ──
  let eventSent = 0;
  const { data: tomorrowEvents } = await admin
    .from("evenements")
    .select("id, title, start_at, organizations(name)")
    .eq("status", "publie")
    .gte("start_at", dayStart.toISOString())
    .lte("start_at", dayEnd.toISOString());

  for (const ev of (tomorrowEvents ?? []) as unknown as Array<{
    id: string; title: string; start_at: string;
    organizations: { name: string } | null;
  }>) {
    const { data: regs } = await admin
      .from("event_registrations")
      .select("id, full_name, email")
      .eq("event_id", ev.id)
      .eq("status", "inscrit");

    // Billets encore valides de l'événement, groupés par inscription : ce sont
    // eux qui portent le lien d'annulation (/billet/<token>, libère la place).
    const { data: tickets } = await admin
      .from("event_tickets")
      .select("registration_id, holder_name, ticket_token")
      .eq("event_id", ev.id);
    const ticketsByReg = new Map<string, { holderName: string; url: string }[]>();
    for (const t of tickets ?? []) {
      if (!t.registration_id) continue;
      const list = ticketsByReg.get(t.registration_id) ?? [];
      list.push({
        holderName: t.holder_name,
        url: `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/billet/${t.ticket_token}`,
      });
      ticketsByReg.set(t.registration_id, list);
    }

    for (const r of regs ?? []) {
      if (!r.email) continue;
      const ok = await sendMail({
        to: r.email,
        subject: `C'est demain ! ${ev.title} · ${ev.organizations?.name ?? "Casa Minga"}`,
        html: tplEvenementRappel({
          orgName: ev.organizations?.name ?? "Casa Minga Lieux",
          firstName: r.full_name?.split(" ")[0] ?? "",
          eventTitle: ev.title,
          startAt: ev.start_at,
          tickets: ticketsByReg.get(r.id) ?? [],
        }),
      });
      if (ok) eventSent++;
    }
  }

  await logCronRun("reminders", "ok", { rowsAffected: resaSent + adhSent + eventSent });
  return NextResponse.json({ ok: true, reservationsReminded: resaSent, adhesionsReminded: adhSent, eventsReminded: eventSent });
}
