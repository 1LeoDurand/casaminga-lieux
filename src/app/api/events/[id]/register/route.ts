import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  let body: { full_name: string; email: string; phone?: string; seats?: number; notes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { full_name, email, phone, seats = 1, notes } = body;
  if (!full_name?.trim() || !email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Nom et email obligatoires." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Service non configuré." }, { status: 503 });

  // Récupérer l'événement
  const { data: event } = await supabase
    .from("evenements").select("id, organization_id, title, capacity, status, start_at").eq("id", eventId).maybeSingle();

  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  if (event.status !== "publie") return NextResponse.json({ error: "Cet événement n'est plus ouvert aux inscriptions." }, { status: 400 });

  // Vérifier la capacité
  let registrationStatus = "inscrit";
  if (event.capacity) {
    const { count } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "inscrit");
    const taken = (count ?? 0) + seats;
    if (taken > event.capacity) registrationStatus = "liste_attente";
  }

  // Créer l'inscription
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
      ticket_token: crypto.randomUUID().replace(/-/g, ""),
    })
    .select("id, status, ticket_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email de confirmation
  try {
    const { sendMail } = await import("@/lib/mail");
    const eventDate = new Date(event.start_at).toLocaleDateString("fr-FR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
    const isWaiting = registrationStatus === "liste_attente";

    // Billet QR (seulement si inscrit confirmé)
    let ticketBlock = "";
    if (!isWaiting && reg.ticket_token) {
      const { ticketQrDataUrl } = await import("@/lib/tickets");
      const { PUBLIC_SITE_BASE } = await import("@/lib/site-public/url");
      const qr = await ticketQrDataUrl(reg.ticket_token);
      const billetUrl = `${PUBLIC_SITE_BASE}/billet/${reg.ticket_token}`;
      ticketBlock = `
        <div style="margin-top:20px;padding:20px;border:1px solid #E5DDD6;border-radius:14px;text-align:center">
          <p style="margin:0 0 8px;font-weight:700">🎟️ Votre billet</p>
          <img src="${qr}" alt="QR billet" width="200" height="200" style="display:block;margin:0 auto" />
          <p style="margin:10px 0 0;font-size:12px;color:#9c9590">Présentez ce QR code à l'entrée.</p>
          <a href="${billetUrl}" style="display:inline-block;margin-top:10px;color:#E8714D;font-weight:600;text-decoration:none">Voir mon billet en ligne →</a>
        </div>`;
    }

    await sendMail({
      to: email,
      subject: isWaiting
        ? `Liste d'attente — ${event.title}`
        : `Inscription confirmée — ${event.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2c2c2c">
          <h2>${isWaiting ? "Vous êtes sur liste d'attente 🕐" : "Inscription confirmée ✅"}</h2>
          <p>Bonjour ${full_name},</p>
          <p>${isWaiting
            ? `L'événement <strong>${event.title}</strong> est complet. Vous êtes inscrit(e) sur la liste d'attente et serez prévenu(e) si une place se libère.`
            : `Votre inscription à <strong>${event.title}</strong> est confirmée.`
          }</p>
          <p><strong>📅 ${eventDate}</strong></p>
          ${ticketBlock}
        </div>`,
      category: "bienvenue",
      organizationId: event.organization_id,
    });
  } catch (e) {
    console.error("register: email non envoyé", e);
  }

  return NextResponse.json({ ok: true, status: registrationStatus, id: reg.id });
}
