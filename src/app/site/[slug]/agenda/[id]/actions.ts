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
  const { data, error } = await supabase
    .from("event_registrations")
    .insert({
      event_id: payload.eventId,
      organization_id: payload.organizationId,
      prenom: payload.prenom,
      nom: payload.nom,
      email: payload.email,
      telephone: payload.telephone ?? null,
      nb_places: payload.nbPlaces,
      participants: payload.participants,
      montant_total: payload.montantTotal,
      status: "confirme",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createEventRegistration]", error);
    return { ok: false, error: "Une erreur est survenue. Réessayez dans un instant." };
  }

  return { ok: true, id: data.id };
}
