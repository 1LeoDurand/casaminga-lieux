"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { generateMonthlyInvoices } from "@/lib/invoicing/generate";

type Result = { ok: boolean; error?: string; summary?: string };

const NOT_CONFIGURED: Result = { ok: false, error: "Disponible une fois Supabase configuré." };

export interface SubscriptionInput {
  person_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  designation: string | null;
  monthly_amount_ht: number;
  vat_applicable: boolean;
  vat_rate: number;
  day_of_month: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export async function saveSubscription(
  orgId: string,
  orgSlug: string,
  input: SubscriptionInput,
  id?: string
): Promise<Result> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (!input.client_name.trim()) return { ok: false, error: "Nom du coworker requis." };
  const supabase = await createClient();

  const payload = {
    organization_id: orgId,
    person_id: input.person_id,
    client_name: input.client_name.trim(),
    client_email: input.client_email,
    client_address: input.client_address,
    designation: input.designation,
    monthly_amount_ht: input.monthly_amount_ht,
    vat_applicable: input.vat_applicable,
    vat_rate: input.vat_rate,
    day_of_month: input.day_of_month,
    active: input.active,
    start_date: input.start_date,
    end_date: input.end_date,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("coworking_subscriptions").update(payload).eq("id", id)
    : await supabase.from("coworking_subscriptions").insert(payload);

  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/factures/coworking`);
  return { ok: true };
}

export async function deleteSubscription(orgSlug: string, id: string): Promise<Result> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("coworking_subscriptions").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/factures/coworking`);
  return { ok: true };
}

/** Génère manuellement les factures du mois (avec envoi email). */
export async function generateNow(orgId: string, orgSlug: string): Promise<Result> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const r = await generateMonthlyInvoices(supabase, orgId, { sendEmails: true, force: true });
  revalidatePath(`/dashboard/${orgSlug}/factures/coworking`);
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  if (r.errors.length) return { ok: false, error: r.errors.join(" · "), summary: `${r.created} créée(s), ${r.emailed} envoyée(s)` };
  return { ok: true, summary: `${r.created} facture(s) créée(s), ${r.emailed} envoyée(s) par email, ${r.skipped} ignorée(s).` };
}
