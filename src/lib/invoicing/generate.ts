import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTotals, type InvoiceLine, type InvoiceSettings } from "./types";

function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d = new Date()): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export interface GenerateResult {
  created: number;
  emailed: number;
  skipped: number;
  errors: string[];
}

/**
 * Génère les factures mensuelles des abonnements coworking dus pour une org.
 * Idempotent : un abonnement déjà facturé ce mois (last_invoiced_month) est ignoré.
 *
 * @param client  Supabase (service_role pour le cron, ou client utilisateur pour le bouton manuel)
 * @param orgId   organisation cible
 * @param opts.sendEmails  envoie le PDF par email au client
 * @param opts.force       ignore la contrainte day_of_month (génère même avant le jour prévu)
 */
export async function generateMonthlyInvoices(
  client: SupabaseClient,
  orgId: string,
  opts: { sendEmails?: boolean; force?: boolean } = {}
): Promise<GenerateResult> {
  const result: GenerateResult = { created: 0, emailed: 0, skipped: 0, errors: [] };
  const now = new Date();
  const monthKey = currentMonthKey(now);
  const today = now.getDate();

  const { data: settings } = await client
    .from("invoice_settings").select("*").eq("organization_id", orgId).maybeSingle();

  const { data: subs } = await client
    .from("coworking_subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("active", true);

  if (!subs || subs.length === 0) return result;

  const todayISO = now.toISOString().slice(0, 10);

  for (const sub of subs) {
    // Déjà facturé ce mois ?
    if (sub.last_invoiced_month === monthKey) { result.skipped++; continue; }
    // Jour du mois pas encore atteint (sauf force) ?
    if (!opts.force && today < (sub.day_of_month ?? 1)) { result.skipped++; continue; }
    // Hors période d'activité ?
    if (sub.start_date && sub.start_date > todayISO) { result.skipped++; continue; }
    if (sub.end_date && sub.end_date < todayISO) { result.skipped++; continue; }

    const vatApplicable = Boolean(sub.vat_applicable);
    const lines: InvoiceLine[] = [
      {
        designation: sub.designation || `Coworking — ${monthLabel(now)}`,
        qty: 1,
        unit_ht: Number(sub.monthly_amount_ht) || 0,
        vat_rate: vatApplicable ? Number(sub.vat_rate) || 0 : 0,
      },
    ];
    const totals = computeTotals(lines, vatApplicable);

    // 1. Créer le brouillon
    const { data: inv, error: insErr } = await client
      .from("invoices")
      .insert({
        organization_id: orgId,
        client_id: sub.person_id,
        client_name: sub.client_name,
        client_email: sub.client_email,
        client_address: sub.client_address,
        issue_date: todayISO,
        due_date: todayISO,
        lines,
        vat_applicable: vatApplicable,
        ...totals,
        status: "brouillon",
        source: "abonnement",
        subscription_id: sub.id,
      })
      .select("*")
      .single();
    if (insErr || !inv) { result.errors.push(`${sub.client_name}: ${insErr?.message}`); continue; }

    // 2. Numéro séquentiel + émission
    const { data: number, error: rpcErr } = await client.rpc("assign_invoice_number", { p_org: orgId });
    if (rpcErr || !number) { result.errors.push(`${sub.client_name}: numérotation`); continue; }
    await client.from("invoices").update({ number, status: "emise" }).eq("id", inv.id);
    result.created++;

    // 3. Anti-doublon
    await client.from("coworking_subscriptions")
      .update({ last_invoiced_month: monthKey, updated_at: new Date().toISOString() })
      .eq("id", sub.id);

    // 4. Email + PDF
    if (opts.sendEmails && sub.client_email) {
      try {
        const [{ renderInvoicePdf }, { sendMail }, { tplFactureRappel }, { formatEuros }] = await Promise.all([
          import("./pdf"), import("@/lib/mail"), import("@/lib/mail-templates"), import("./types"),
        ]);
        const set: InvoiceSettings = (settings as InvoiceSettings) ?? ({
          organization_id: orgId, issuer_name: null, issuer_address: null, siret: null,
          vat_number: null, email: null, phone: null, iban: null, bic: null,
          payment_terms_days: 30, late_penalty: null, accent_color: "#FF8A65",
          footer_mentions: null, number_prefix: "FAC-", logo_url: null, updated_at: todayISO,
        } as InvoiceSettings);
        const pdf = await renderInvoicePdf({ ...inv, number, status: "emise" }, set);
        const ok = await sendMail({
          to: sub.client_email,
          subject: `Facture ${number} · ${set.issuer_name ?? "Coworking"}`,
          html: tplFactureRappel({
            orgName: set.issuer_name ?? "Casa Minga Lieux",
            clientName: sub.client_name,
            invoiceNumber: number,
            amountTtc: formatEuros(totals.total_ttc),
            dueDate: now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
            iban: set.iban,
          }),
          replyTo: set.email ?? undefined,
          attachments: [{ filename: `${number}.pdf`, content: pdf, contentType: "application/pdf" }],
        });
        if (ok) {
          result.emailed++;
          await client.from("invoices").update({ status: "envoyee" }).eq("id", inv.id);
        }
      } catch (e) {
        result.errors.push(`${sub.client_name}: email ${(e as Error).message}`);
      }
    }
  }

  return result;
}
