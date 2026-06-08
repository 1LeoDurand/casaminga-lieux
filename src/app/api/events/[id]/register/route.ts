import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  let body: { full_name: string; email: string; phone?: string; participants?: string[]; notes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { full_name, email, phone, notes } = body;
  if (!full_name?.trim() || !email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Nom et email obligatoires." }, { status: 400 });
  }

  // Liste des participants nominatifs (1 billet chacun). Défaut : l'acheteur seul.
  const holders = (body.participants ?? [])
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  if (holders.length === 0) holders.push(full_name.trim());
  const seats = holders.length;

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Service non configuré." }, { status: 503 });

  const { data: event } = await supabase
    .from("evenements").select("id, organization_id, title, capacity, status, start_at").eq("id", eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  if (event.status !== "publie") return NextResponse.json({ error: "Cet événement n'est plus ouvert aux inscriptions." }, { status: 400 });

  // Capacité = nombre de billets déjà émis
  let registrationStatus = "inscrit";
  if (event.capacity) {
    const { count } = await supabase
      .from("event_tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) + seats > event.capacity) registrationStatus = "liste_attente";
  }

  // 1. Réservation (l'acheteur)
  const { data: reg, error } = await supabase
    .from("event_registrations")
    .insert({
      organization_id: event.organization_id,
      event_id: eventId,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      seats,
      status: registrationStatus,
      notes: notes?.trim() || null,
      source: "public",
    })
    .select("id, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Un billet par participant (sauf liste d'attente)
  type TicketRow = { holder_name: string; ticket_token: string };
  let tickets: TicketRow[] = [];
  if (registrationStatus === "inscrit") {
    const { data: created } = await supabase
      .from("event_tickets")
      .insert(holders.map((name) => ({
        organization_id: event.organization_id,
        event_id: eventId,
        registration_id: reg.id,
        holder_name: name,
      })))
      .select("holder_name, ticket_token");
    tickets = (created ?? []) as TicketRow[];
  }

  // 3. Email de confirmation avec un QR par billet
  try {
    const { sendMail } = await import("@/lib/mail");
    const eventDate = new Date(event.start_at).toLocaleDateString("fr-FR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
    const isWaiting = registrationStatus === "liste_attente";

    let ticketsBlock = "";
    if (!isWaiting && tickets.length) {
      const { ticketQrDataUrl } = await import("@/lib/tickets");
      const { PUBLIC_SITE_BASE } = await import("@/lib/site-public/url");
      const blocks = await Promise.all(tickets.map(async (t) => {
        const qr = await ticketQrDataUrl(t.ticket_token);
        const url = `${PUBLIC_SITE_BASE}/billet/${t.ticket_token}`;
        return `
          <div style="margin-top:14px;padding:16px;border:1px solid #E5DDD6;border-radius:14px;text-align:center">
            <div style="font-weight:700;margin-bottom:8px">🎟️ ${t.holder_name}</div>
            <img src="${qr}" alt="QR" width="180" height="180" style="display:block;margin:0 auto" />
            <a href="${url}" style="display:inline-block;margin-top:8px;color:#E8714D;font-weight:600;text-decoration:none;font-size:13px">Voir ce billet →</a>
          </div>`;
      }));
      ticketsBlock = `<p style="margin-top:18px;font-weight:700">Vos billets (${tickets.length}) :</p>${blocks.join("")}
        <p style="font-size:12px;color:#9c9590;margin-top:10px">Chaque participant présente SON QR code à l'entrée.</p>`;
    }

    await sendMail({
      to: email,
      subject: isWaiting ? `Liste d'attente — ${event.title}` : `Inscription confirmée — ${event.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2c2c2c">
          <h2>${isWaiting ? "Vous êtes sur liste d'attente 🕐" : "Inscription confirmée ✅"}</h2>
          <p>Bonjour ${full_name},</p>
          <p>${isWaiting
            ? `L'événement <strong>${event.title}</strong> est complet. Vous êtes sur la liste d'attente.`
            : `Votre inscription à <strong>${event.title}</strong> est confirmée (${seats} ${seats > 1 ? "places" : "place"}).`}</p>
          <p><strong>📅 ${eventDate}</strong></p>
          ${ticketsBlock}
        </div>`,
      category: "bienvenue",
      organizationId: event.organization_id,
    });
  } catch (e) {
    console.error("register: email non envoyé", e);
  }

  return NextResponse.json({ ok: true, status: registrationStatus, id: reg.id, tickets: tickets.length });
}
