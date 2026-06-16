"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

/** Un billet nominatif (participant). C'est l'unité de présence/scan. */
export interface EventTicket {
  id: string;
  registration_id: string | null;
  holder_name: string;
  ticket_token: string;
  checked_in_at: string | null;
  email: string | null;
  reg_status: string | null;
  stripe_session_id: string | null;
  created_at: string;
}

type AR = { ok: boolean; error?: string };

/** Liste les billets d'un événement (jointure vers la réservation pour l'email/statut). */
export async function getTicketsForEvent(eventId: string): Promise<EventTicket[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_tickets")
    .select("id, registration_id, holder_name, ticket_token, checked_in_at, created_at, event_registrations(email, status, stripe_session_id)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((t: Record<string, unknown>) => {
    const reg = t.event_registrations as { email: string | null; status: string | null; stripe_session_id?: string | null } | null;
    return {
      id: t.id as string,
      registration_id: (t.registration_id as string) ?? null,
      holder_name: t.holder_name as string,
      ticket_token: t.ticket_token as string,
      checked_in_at: (t.checked_in_at as string) ?? null,
      email: reg?.email ?? null,
      reg_status: reg?.status ?? null,
      stripe_session_id: reg?.stripe_session_id ?? null,
      created_at: t.created_at as string,
    };
  });
}

/** Ajout manuel au guichet : crée une réservation + 1 billet nominatif. */
export async function addRegistrationManual(
  orgSlug: string, orgId: string, eventId: string,
  input: { full_name: string; email: string; phone?: string; notes?: string }
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { data: reg, error } = await supabase.from("event_registrations").insert({
    organization_id: orgId,
    event_id: eventId,
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    seats: 1,
    notes: input.notes?.trim() || null,
    source: "manuel",
    status: "inscrit",
  }).select("id").single();
  if (error) return { ok: false, error: humanError(error) };

  const { error: te } = await supabase.from("event_tickets").insert({
    organization_id: orgId,
    event_id: eventId,
    registration_id: reg.id,
    holder_name: input.full_name.trim(),
  });
  if (te) return { ok: false, error: humanError(te) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

/** Pointe / dé-pointe un billet (check-in manuel au guichet). */
export async function checkInTicket(orgSlug: string, ticketId: string, checkedIn: boolean): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_tickets")
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq("id", ticketId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

/** Supprime un billet — la place libérée profite à la liste d'attente. */
export async function removeTicket(orgSlug: string, ticketId: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("event_tickets").select("event_id").eq("id", ticketId).maybeSingle();
  const { error } = await supabase.from("event_tickets").delete().eq("id", ticketId);
  if (error) return { ok: false, error: humanError(error) };
  if (ticket?.event_id) {
    const { promoteWaitlist } = await import("@/lib/events/register");
    await promoteWaitlist(ticket.event_id).catch(() => 0);
  }
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

// ── Liste d'attente ────────────────────────────────────────────

export interface WaitlistEntry {
  id: string;
  full_name: string;
  email: string;
  seats: number;
  created_at: string;
}

/** Réservations en liste d'attente d'un événement (ordre d'arrivée). */
export async function getWaitlistForEvent(eventId: string): Promise<WaitlistEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select("id, full_name, email, seats, created_at")
    .eq("event_id", eventId)
    .eq("status", "liste_attente")
    .order("created_at", { ascending: true });
  return (data ?? []) as WaitlistEntry[];
}

/** Promotion manuelle d'une réservation en attente (peut dépasser la capacité). */
export async function promoteWaitlistEntry(orgSlug: string, regId: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const { promoteRegistrationById } = await import("@/lib/events/register");
  const res = await promoteRegistrationById(regId);
  if (res.ok) revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return res;
}
