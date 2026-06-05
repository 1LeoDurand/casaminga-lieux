"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { computeTotals, type InvoiceLine, type InvoiceSettings } from "@/lib/invoicing/types";
import { humanError } from "@/lib/errors";

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

  if (error) return { ok: false, error: humanError(error) };
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
  object: string | null;
  reference: string | null;
  pole: string | null;
  pole_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
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
    object: input.object ?? null,
    reference: input.reference ?? null,
    pole: input.pole ?? null,
    pole_id: input.pole_id ?? null,
    payment_method: input.payment_method ?? null,
    paid_at: input.paid_at ?? null,
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
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/factures`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...payload, status: "brouillon", source: "manuelle" })
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
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
  if (error) return { ok: false, error: humanError(error) };

  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id };
}

// ── Envoi de la facture par email (PDF en pièce jointe) ──
export async function sendInvoiceEmail(
  orgId: string,
  orgSlug: string,
  invoiceId: string,
  isReminder = false
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "Facture introuvable." };
  if (!inv.number) return { ok: false, error: "Émettez la facture avant de l'envoyer." };
  if (!inv.client_email) return { ok: false, error: "Aucun email client renseigné." };

  const { data: settings } = await supabase
    .from("invoice_settings").select("*").eq("organization_id", orgId).maybeSingle();

  // Imports dynamiques (modules serveur lourds : PDF + mail)
  const [{ renderInvoicePdf }, { sendMail }, { tplFactureRappel }, { formatEuros }] = await Promise.all([
    import("@/lib/invoicing/pdf"),
    import("@/lib/mail"),
    import("@/lib/mail-templates"),
    import("@/lib/invoicing/types"),
  ]);

  const fallbackSettings = settings ?? {
    organization_id: orgId, issuer_name: null, issuer_address: null, siret: null,
    vat_number: null, email: null, phone: null, iban: null, bic: null,
    payment_terms_days: 30, late_penalty: null, accent_color: "#FF8A65",
    footer_mentions: null, number_prefix: "FAC-", logo_url: null,
    updated_at: new Date().toISOString(),
  };

  const pdf = await renderInvoicePdf(inv, fallbackSettings);
  const orgName = fallbackSettings.issuer_name ?? "Casa Minga Lieux";
  const dueDate = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const ok = await sendMail({
    to: inv.client_email,
    subject: `${isReminder ? "Rappel — " : ""}Facture ${inv.number} · ${orgName}`,
    html: tplFactureRappel({
      orgName,
      clientName: inv.client_name,
      invoiceNumber: inv.number,
      amountTtc: formatEuros(inv.total_ttc),
      dueDate,
      iban: fallbackSettings.iban,
      isReminder,
    }),
    replyTo: fallbackSettings.email ?? undefined,
    attachments: [{ filename: `${inv.number}.pdf`, content: pdf, contentType: "application/pdf" }],
    category: isReminder ? "rappel" : "facture",
    organizationId: orgId,
  });

  if (!ok) return { ok: false, error: "Échec de l'envoi (vérifiez la configuration SMTP)." };

  // Passe en "envoyée" si ce n'était pas un rappel sur facture déjà avancée
  if (inv.status === "emise") {
    await supabase.from("invoices").update({ status: "envoyee", updated_at: new Date().toISOString() }).eq("id", invoiceId);
  }
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id: invoiceId };
}

// ── Avoir (note de crédit) : annule une facture émise par une facture négative ──
export async function createCreditNote(
  orgId: string,
  orgSlug: string,
  invoiceId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "Facture introuvable." };
  if (!inv.number) return { ok: false, error: "Seule une facture émise peut faire l'objet d'un avoir." };
  if (inv.kind === "avoir") return { ok: false, error: "Un avoir ne peut pas être annulé par un avoir." };

  // Lignes inversées (montants négatifs)
  const negLines = (inv.lines as { designation: string; qty: number; unit_ht: number; vat_rate: number }[])
    .map((l) => ({ ...l, unit_ht: -Math.abs(l.unit_ht) }));

  const { data: avoir, error: insErr } = await supabase
    .from("invoices")
    .insert({
      organization_id: orgId,
      kind: "avoir",
      parent_invoice_id: inv.id,
      client_id: inv.client_id,
      client_name: inv.client_name,
      client_email: inv.client_email,
      client_address: inv.client_address,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      lines: negLines,
      vat_applicable: inv.vat_applicable,
      total_ht: -Math.abs(inv.total_ht),
      total_vat: -Math.abs(inv.total_vat),
      total_ttc: -Math.abs(inv.total_ttc),
      notes: `Avoir sur facture ${inv.number}`,
      status: "brouillon",
      source: inv.source,
    })
    .select("id")
    .single();
  if (insErr || !avoir) return { ok: false, error: insErr?.message ?? "Création de l'avoir impossible." };

  // Numéro séquentiel pour l'avoir
  const { data: number, error: rpcErr } = await supabase.rpc("assign_invoice_number", { p_org: orgId });
  if (rpcErr || !number) return { ok: false, error: "Numérotation de l'avoir impossible." };
  await supabase.from("invoices").update({ number, status: "emise" }).eq("id", avoir.id);

  // La facture d'origine passe en annulée
  await supabase.from("invoices").update({ status: "annulee", updated_at: new Date().toISOString() }).eq("id", inv.id);

  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id: avoir.id };
}

// ── Changement de statut (payée / annulée…) ──
export async function setInvoiceStatus(
  orgSlug: string,
  id: string,
  status: "payee" | "annulee" | "envoyee",
  opts?: { payment_method?: string; paid_at?: string }
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "payee") {
    if (opts?.payment_method) patch.payment_method = opts.payment_method;
    patch.paid_at = opts?.paid_at ?? new Date().toISOString().slice(0, 10);
  }
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/factures`);
  return { ok: true, id };
}
