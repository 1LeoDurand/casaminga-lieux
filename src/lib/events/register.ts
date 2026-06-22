import "server-only";
import { createAdminClient } from "@/lib/admin/guard";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Moteur d'inscription unique aux événements (Lot 5).
 *
 * Toutes les portes d'entrée (tunnel public, API route, ajout admin futur)
 * passent par `registerForEvent` : c'est le SEUL endroit qui applique la
 * capacité, la liste d'attente, crée les billets et envoie l'email.
 * L'annulation par billet (`cancelTicketByToken`) libère la place et
 * promeut automatiquement la liste d'attente.
 */

export interface RegisterInput {
  eventId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  /** Un billet nominatif par participant. Défaut : l'acheteur seul. */
  participants?: string[];
  notes?: string | null;
  source: "public" | "manuel";
  amountTtc?: number;
  /**
   * free   = gratuit → billets valides d'emblée, QR immédiat.
   * online = payant en ligne → billets créés 'pending', email SANS QR.
   * onsite = payant au guichet → billets créés 'paid', QR immédiat.
   */
  paymentMode?: "free" | "online" | "onsite";
}

export type RegisterResult =
  | { ok: true; status: "inscrit" | "liste_attente"; registrationId: string; ticketsCount: number }
  | { ok: false; error: string };

interface TicketRow { holder_name: string; ticket_token: string }

/** Places restantes d'un événement (null = capacité illimitée). */
export async function remainingSeats(eventId: string): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: event } = await admin
    .from("evenements").select("capacity").eq("id", eventId).maybeSingle();
  if (!event?.capacity) return null;
  const { count } = await admin
    .from("event_tickets")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  return Math.max(0, event.capacity - (count ?? 0));
}

/** Bloc HTML « vos billets » avec un QR par participant. */
async function buildTicketsBlock(tickets: TicketRow[]): Promise<string> {
  const { ticketQrDataUrl } = await import("@/lib/tickets");
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
  return `<p style="margin-top:18px;font-weight:700">Vos billets (${tickets.length}) :</p>${blocks.join("")}
    <p style="font-size:12px;color:#9c9590;margin-top:10px">Chaque participant présente SON QR code à l'entrée.
    En cas d'empêchement, ouvrez un billet pour annuler la place.</p>`;
}

/**
 * Envoie l'email de confirmation avec (ou sans) les QR billets.
 * Exporté pour être réutilisé depuis le webhook Stripe (passage pending→paid).
 */
export async function issueTicketsEmail(opts: {
  to: string; fullName: string; eventTitle: string; startAt: string;
  organizationId: string; tickets: TicketRow[]; waiting: boolean; seats: number;
  subjectPrefix?: string;
  /** Si true : email de réservation sans QR (paiement en attente). */
  pendingPayment?: boolean;
}) {
  const { sendMail } = await import("@/lib/mail");
  const eventDate = new Date(opts.startAt).toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  if (opts.pendingPayment) {
    await sendMail({
      to: opts.to,
      subject: `Réservation en attente de paiement — ${opts.eventTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2c2c2c">
          <h2>Réservation enregistrée — finalisez votre paiement 💳</h2>
          <p>Bonjour ${opts.fullName},</p>
          <p>Votre réservation pour <strong>${opts.eventTitle}</strong> est bien enregistrée
          (${opts.seats} ${opts.seats > 1 ? "places" : "place"}).</p>
          <p><strong>📅 ${eventDate}</strong></p>
          <p style="margin-top:16px;padding:12px 16px;background:#fff8f0;border:1px solid #f5c180;border-radius:10px;font-size:14px">
            ⏳ Vos billets QR vous seront envoyés dès confirmation de votre paiement.
            Si vous avez été redirigé vers Stripe, complétez le paiement pour recevoir vos billets.
          </p>
        </div>`,
      category: "billetterie",
      organizationId: opts.organizationId,
    });
    return;
  }

  const ticketsBlock = !opts.waiting && opts.tickets.length
    ? await buildTicketsBlock(opts.tickets)
    : "";
  await sendMail({
    to: opts.to,
    subject: opts.waiting
      ? `Liste d'attente — ${opts.eventTitle}`
      : `${opts.subjectPrefix ?? "Inscription confirmée"} — ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2c2c2c">
        <h2>${opts.waiting ? "Vous êtes sur liste d'attente 🕐" : `${opts.subjectPrefix ?? "Inscription confirmée"} ✅`}</h2>
        <p>Bonjour ${opts.fullName},</p>
        <p>${opts.waiting
          ? `L'événement <strong>${opts.eventTitle}</strong> est complet. Vous êtes sur la liste d'attente : si une place se libère, vous recevrez automatiquement vos billets par email.`
          : `Votre inscription à <strong>${opts.eventTitle}</strong> est confirmée (${opts.seats} ${opts.seats > 1 ? "places" : "place"}).`}</p>
        <p><strong>📅 ${eventDate}</strong></p>
        ${ticketsBlock}
      </div>`,
    category: "billetterie",
    organizationId: opts.organizationId,
  });
}

/** @internal Alias pour les appels internes au fichier. */
const sendTicketsEmail = issueTicketsEmail;

/** Inscription à un événement — capacité, liste d'attente, billets, email. */
export async function registerForEvent(input: RegisterInput): Promise<RegisterResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (!fullName || !email || !email.includes("@")) {
    return { ok: false, error: "Nom et email obligatoires." };
  }

  // Anti-spam : 3 inscriptions max / email / événement / heure (surface publique)
  if (input.source === "public" && !rateLimit(`evreg:${input.eventId}:${email}`, 3, 3_600_000)) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans une heure." };
  }

  const holders = (input.participants ?? []).map((p) => (p ?? "").trim()).filter(Boolean);
  if (holders.length === 0) holders.push(fullName);
  const seats = holders.length;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service non configuré." };

  const { data: event } = await admin
    .from("evenements")
    .select("id, organization_id, title, capacity, status, start_at")
    .eq("id", input.eventId)
    .maybeSingle();
  if (!event) return { ok: false, error: "Événement introuvable." };
  if (event.status !== "publie") {
    return { ok: false, error: "Cet événement n'est plus ouvert aux inscriptions." };
  }

  // Capacité = nombre de billets déjà émis
  let status: "inscrit" | "liste_attente" = "inscrit";
  if (event.capacity) {
    const { count } = await admin
      .from("event_tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", input.eventId);
    if ((count ?? 0) + seats > event.capacity) status = "liste_attente";
  }

  const { data: reg, error } = await admin
    .from("event_registrations")
    .insert({
      organization_id: event.organization_id,
      event_id: input.eventId,
      full_name: fullName,
      email,
      phone: input.phone?.trim() || null,
      seats,
      status,
      notes: input.notes?.trim() || null,
      source: input.source,
      amount_ttc: input.amountTtc ?? 0,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const mode = input.paymentMode ?? "free";
  // 'online' = paiement Stripe en cours → billets pending (place tenue, QR pas encore livré)
  const ticketPaymentStatus = mode === "online" ? "pending" : mode === "onsite" ? "paid" : "free";

  let tickets: TicketRow[] = [];
  if (status === "inscrit") {
    const { data: created } = await admin
      .from("event_tickets")
      .insert(holders.map((name) => ({
        organization_id: event.organization_id,
        event_id: input.eventId,
        registration_id: reg.id,
        holder_name: name,
        payment_status: ticketPaymentStatus,
      })))
      .select("holder_name, ticket_token");
    tickets = (created ?? []) as TicketRow[];
  }

  try {
    await sendTicketsEmail({
      to: email, fullName, eventTitle: event.title, startAt: event.start_at,
      organizationId: event.organization_id, tickets, waiting: status === "liste_attente", seats,
      pendingPayment: mode === "online" && status === "inscrit",
    });
  } catch (e) {
    console.error("registerForEvent: email non envoyé", e);
  }

  return { ok: true, status, registrationId: reg.id, ticketsCount: tickets.length };
}

/**
 * Promeut la liste d'attente d'un événement tant qu'il reste des places.
 * Ordre d'arrivée strict ; une réservation trop grande pour les places
 * restantes bloque la file (pas de dépassement silencieux).
 */
export async function promoteWaitlist(eventId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data: event } = await admin
    .from("evenements")
    .select("id, organization_id, title, capacity, start_at, status")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.capacity || event.status !== "publie") return 0;

  let promoted = 0;
  // Boucle bornée : au pire, toute la file passe.
  for (let guard = 0; guard < 50; guard++) {
    const { count } = await admin
      .from("event_tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const free = event.capacity - (count ?? 0);
    if (free <= 0) break;

    const { data: next } = await admin
      .from("event_registrations")
      .select("id, full_name, email, seats")
      .eq("event_id", eventId)
      .eq("status", "liste_attente")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!next) break;
    if (next.seats > free) break; // pas assez de places pour le premier de la file

    // Billets : nominatifs sur le nom de l'acheteur (les noms des
    // participants ne sont pas connus pour une réservation en attente)
    const holders = Array.from({ length: next.seats }, (_, i) =>
      next.seats > 1 ? `${next.full_name} (${i + 1})` : next.full_name
    );
    const { data: created, error: te } = await admin
      .from("event_tickets")
      .insert(holders.map((name) => ({
        organization_id: event.organization_id,
        event_id: eventId,
        registration_id: next.id,
        holder_name: name,
      })))
      .select("holder_name, ticket_token");
    if (te) break;

    await admin.from("event_registrations").update({ status: "inscrit" }).eq("id", next.id);

    try {
      await sendTicketsEmail({
        to: next.email, fullName: next.full_name, eventTitle: event.title,
        startAt: event.start_at, organizationId: event.organization_id,
        tickets: (created ?? []) as TicketRow[], waiting: false, seats: next.seats,
        subjectPrefix: "Une place s'est libérée ! Inscription confirmée",
      });
    } catch (e) {
      console.error("promoteWaitlist: email non envoyé", e);
    }
    promoted++;
  }
  return promoted;
}

/**
 * Promotion manuelle d'une réservation en liste d'attente (décision admin —
 * peut dépasser la capacité, c'est un choix assumé du lieu).
 */
export async function promoteRegistrationById(regId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service non configuré." };

  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, event_id, organization_id, full_name, email, seats, status")
    .eq("id", regId)
    .maybeSingle();
  if (!reg) return { ok: false, error: "Réservation introuvable." };
  if (reg.status !== "liste_attente") return { ok: false, error: "Cette réservation n'est pas en liste d'attente." };

  const { data: event } = await admin
    .from("evenements")
    .select("id, title, start_at")
    .eq("id", reg.event_id)
    .maybeSingle();
  if (!event) return { ok: false, error: "Événement introuvable." };

  const holders = Array.from({ length: reg.seats }, (_, i) =>
    reg.seats > 1 ? `${reg.full_name} (${i + 1})` : reg.full_name
  );
  const { data: created, error: te } = await admin
    .from("event_tickets")
    .insert(holders.map((name) => ({
      organization_id: reg.organization_id,
      event_id: reg.event_id,
      registration_id: reg.id,
      holder_name: name,
    })))
    .select("holder_name, ticket_token");
  if (te) return { ok: false, error: "Impossible de créer les billets." };

  await admin.from("event_registrations").update({ status: "inscrit" }).eq("id", reg.id);

  try {
    await sendTicketsEmail({
      to: reg.email, fullName: reg.full_name, eventTitle: event.title,
      startAt: event.start_at, organizationId: reg.organization_id,
      tickets: (created ?? []) as TicketRow[], waiting: false, seats: reg.seats,
      subjectPrefix: "Une place s'est libérée ! Inscription confirmée",
    });
  } catch (e) {
    console.error("promoteRegistrationById: email non envoyé", e);
  }
  return { ok: true };
}

export type CancelTicketResult =
  | { ok: true; holderName: string; eventTitle: string }
  | { ok: false; error: string };

/** Annulation d'un billet par son porteur (lien public /billet/<token>). */
export async function cancelTicketByToken(token: string): Promise<CancelTicketResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service non configuré." };

  const { data: ticket } = await admin
    .from("event_tickets")
    .select("id, event_id, registration_id, holder_name, checked_in_at")
    .eq("ticket_token", token)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Billet introuvable ou déjà annulé." };
  if (ticket.checked_in_at) {
    return { ok: false, error: "Ce billet a déjà été utilisé à l'entrée — il ne peut plus être annulé." };
  }

  const { data: event } = await admin
    .from("evenements")
    .select("id, title, start_at")
    .eq("id", ticket.event_id)
    .maybeSingle();
  if (!event) return { ok: false, error: "Événement introuvable." };
  if (new Date(event.start_at) <= new Date()) {
    return { ok: false, error: "L'événement a déjà commencé — annulation impossible." };
  }

  const { error } = await admin.from("event_tickets").delete().eq("id", ticket.id);
  if (error) return { ok: false, error: "Erreur lors de l'annulation. Réessayez." };

  // Si c'était le dernier billet de la réservation → réservation annulée
  if (ticket.registration_id) {
    const { count } = await admin
      .from("event_tickets")
      .select("*", { count: "exact", head: true })
      .eq("registration_id", ticket.registration_id);
    if ((count ?? 0) === 0) {
      await admin
        .from("event_registrations")
        .update({ status: "annule" })
        .eq("id", ticket.registration_id);
    }
  }

  // La place libérée profite à la liste d'attente
  try {
    await promoteWaitlist(ticket.event_id);
  } catch (e) {
    console.error("cancelTicketByToken: promotion liste d'attente", e);
  }

  return { ok: true, holderName: ticket.holder_name, eventTitle: event.title };
}
