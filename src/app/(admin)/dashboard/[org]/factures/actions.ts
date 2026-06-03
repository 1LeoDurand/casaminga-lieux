"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { computeTotals, type InvoiceLine, type InvoiceSettings } from "@/lib/invoicing/types";

type ActionResult = { ok: boolean; error?: string; id?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Facturation disponible une fois Supabase configuré (mode production).",
};

// ── Paramètres de facturation ─────────────────────────────────
export async function saveInvoiceSettings(
  orgId: string,
  orgSlug: string,
  settings: Partial<InvoiceSettings>
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const { error } = await supabase.from("invoice_settings").upsert(
    {
      organization_id: orgId,
      issuer_name: settings.issuer_name ?? null,
      issuer_address: settings.issuer_address ?? null,
      siret: settings.siret ?? null,
      vat_number: settings.vat_number ?? null,
      email: settings.email ?? null,
      phone: settings.phone ?? null,
      iban: settings.iban ?? null,
      bic: settings.bic ?? null,
      payment_terms_days: settings.payment_terms_days ?? 30,
      late_penalty: settings.late_penalty ?? null,
      accent_color: settings.accent_color ?? "#FF8A65",
      footer_mentions: settings.footer_mentions ?? null,
      number_prefix: settings.number_prefix ?? "FAC-",
      logo_url: settings.logo_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${orgSlug}/factures/parametres`);
  return { ok: true };
}

// ── Données d'une facture (création / mise à jour brouillon) ──
export interface InvoiceInput {
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  issue_date: string | null;
  due_date: string | null;
  lines: InvoiceLine[];
  vat_applicable: boolean;
  notes: string | null;
}

export async function saveInvoice(
  orgId: string,
  orgSlug: string,
  input: InvoiceInput,
  id?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const totals = computeTotals(input.lines, input.vat_applicable);
  const payload = {
    organization_id: orgId,
    client_id: input.client_id,
    client_name: input.client_name,
    client_email: input.client_email,
    client_address: input.client_address,
    issue_date: input.issue_date,
    due_date: input.due_date,
    lines: input.lines,
    vat_applicable: input.vat_applicable,
    ...totals,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Sécurité : on ne modifie qu'un brouillon (une facture émise est figée).
    const { data: existing } = await supabase
      .from("invoices").select("status").eq("id", id).maybeSingle();
    if (existing && existing.status !== "brouillon") {
      return { ok: false, error: "Une facture émise ne peut plus être modifiée." };
    }
    const { error } = await supabase.from("invoices").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/dashboard/${orgSlug}/factures`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...payload, status: "brouillon", source: "manuelle" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id: data.id };
}

// ── Émission : assigne le numéro séquentiel et fige la facture ──
export async function emitInvoice(
  orgId: string,
  orgSlug: string,
  id: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invoices").select("status, number").eq("id", id).maybeSingle();
  if (!inv) return { ok: false, error: "Facture introuvable." };
  if (inv.number) return { ok: false, error: "Cette facture est déjà émise." };

  // Numéro atomique côté Postgres
  const { data: number, error: rpcErr } = await supabase
    .rpc("assign_invoice_number", { p_org: orgId });
  if (rpcErr || !number) return { ok: false, error: rpcErr?.message ?? "Numérotation impossible." };

  const { error } = await supabase
    .from("invoices")
    .update({
      number,
      status: "emise",
      issue_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id };
}

// ── Changement de statut (payée / annulée…) ──
export async function setInvoiceStatus(
  orgSlug: string,
  id: string,
  status: "payee" | "annulee" | "envoyee"
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id };
}
