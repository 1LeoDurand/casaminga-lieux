"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

export interface EventRegistration {
  id: string;
  organization_id: string;
  event_id: string;
  person_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  seats: number;
  status: "inscrit" | "liste_attente" | "annule";
  payment_status: "gratuit" | "a_payer" | "paye" | "rembourse";
  amount_ttc: number;
  checked_in_at: string | null;
  source: string;
  notes: string | null;
  created_at: string;
}

type AR = { ok: boolean; error?: string };

export async function getRegistrationsForEvent(eventId: string): Promise<EventRegistration[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data ?? []) as EventRegistration[];
}

export async function addRegistrationManual(
  orgSlug: string, orgId: string, eventId: string,
  input: { full_name: string; email: string; phone?: string; seats?: number; notes?: string }
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({
    organization_id: orgId,
    event_id: eventId,
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    seats: input.seats ?? 1,
    notes: input.notes?.trim() || null,
    source: "manuel",
    status: "inscrit",
  });
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

export async function checkInRegistration(orgSlug: string, id: string, checkedIn: boolean): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations")
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

export async function cancelRegistration(orgSlug: string, id: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations")
    .update({ status: "annule" })
    .eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}
