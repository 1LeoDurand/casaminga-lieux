"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface RegistrationPayload {
  eventId: string;
  organizationId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  nbPlaces: number;
  participants: { prenom: string; nom: string }[];
  montantTotal: number;
}

export async function createEventRegistration(
  payload: RegistrationPayload
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    // Mode démo : on simule un succès
    return { ok: true, id: crypto.randomUUID() };
  }

  const supabase = await createClient();
  // Réservation (acheteur) sur le schéma unifié.
  const { data, error } = await supabase
    .from("event_registrations")
    .insert({
      event_id: payload.eventId,
      organization_id: payload.organizationId,
      full_name: `${payload.prenom} ${payload.nom}`.trim(),
      email: payload.email,
      phone: payload.telephone ?? null,
      seats: payload.nbPlaces,
      amount_ttc: payload.montantTotal,
      status: "inscrit",
      source: "public",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createEventRegistration]", error);
    return { ok: false, error: "Une erreur est survenue. Réessayez dans un instant." };
  }

  // Un billet nominatif par participant (chacun son QR).
  const holders = (payload.participants?.length
    ? payload.participants.map((p) => `${p.prenom} ${p.nom}`.trim()).filter(Boolean)
    : [`${payload.prenom} ${payload.nom}`.trim()]);
  if (holders.length) {
    await supabase.from("event_tickets").insert(
      holders.map((name) => ({
        organization_id: payload.organizationId,
        event_id: payload.eventId,
        registration_id: data.id,
        holder_name: name,
      }))
    );
  }

  return { ok: true, id: data.id };
}
