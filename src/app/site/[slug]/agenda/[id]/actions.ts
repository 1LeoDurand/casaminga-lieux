"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { registerForEvent } from "@/lib/events/register";

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

export type RegistrationActionResult =
  | { ok: true; id: string; status: "inscrit" | "liste_attente" }
  | { ok: false; error: string };

/**
 * Inscription depuis le tunnel public du site.
 * Délègue au moteur unique (capacité, liste d'attente, billets, email) —
 * plus aucune insertion directe ici.
 */
export async function createEventRegistration(
  payload: RegistrationPayload
): Promise<RegistrationActionResult> {
  if (!isSupabaseConfigured()) {
    // Mode démo : on simule un succès
    return { ok: true, id: crypto.randomUUID(), status: "inscrit" };
  }

  const participants = (payload.participants ?? [])
    .map((p) => `${p.prenom} ${p.nom}`.trim())
    .filter(Boolean);

  const res = await registerForEvent({
    eventId: payload.eventId,
    fullName: `${payload.prenom} ${payload.nom}`.trim(),
    email: payload.email,
    phone: payload.telephone,
    participants,
    source: "public",
    amountTtc: payload.montantTotal,
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, id: res.registrationId, status: res.status };
}
