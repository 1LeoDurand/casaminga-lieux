import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Invoice, InvoiceSettings, CoworkingSubscription } from "./types";

const DEFAULT_SETTINGS = (orgId: string): InvoiceSettings => ({
  organization_id: orgId,
  issuer_name: null,
  issuer_address: null,
  siret: null,
  vat_number: null,
  email: null,
  phone: null,
  iban: null,
  bic: null,
  payment_terms_days: 30,
  late_penalty: null,
  accent_color: "#FF8A65",
  footer_mentions: null,
  number_prefix: "FAC-",
  number_start: 1,
  logo_url: null,
  require_validation_above: null,
  updated_at: new Date().toISOString(),
});

export async function getInvoiceSettings(orgId: string): Promise<InvoiceSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS(orgId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return (data as InvoiceSettings) ?? DEFAULT_SETTINGS(orgId);
}

/** Vrai si l'org a déjà au moins une facture émise (numéro attribué). Sert à verrouiller number_start. */
export async function hasEmittedInvoices(orgId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("number", "is", null);
  return (count ?? 0) > 0;
}

export async function getInvoices(orgId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data as Invoice[]) ?? [];
}

export async function getInvoiceById(orgId: string, id: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data as Invoice) ?? null;
}

export async function getCoworkingSubscriptions(orgId: string): Promise<CoworkingSubscription[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("coworking_subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .order("active", { ascending: false })
    .order("client_name", { ascending: true });
  return (data as CoworkingSubscription[]) ?? [];
}
