import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { logCronRun } from "@/lib/cron-logger";
import type { Invoice, InvoiceSettings } from "@/lib/invoicing/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Relances de paiement : marque "en_retard" les factures émises/envoyées dont
 * l'échéance est dépassée et envoie un email de rappel (PDF joint).
 * Sécurisé par CRON_SECRET. Idempotent (n'envoie qu'aux non payées/non annulées).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue } = await admin
    .from("invoices")
    .select("*")
    .in("status", ["emise", "envoyee", "en_retard"])
    .eq("kind", "facture")
    .not("number", "is", null)
    .lt("due_date", today);

  if (!overdue || overdue.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  const [{ renderInvoicePdf }, { sendMail }, { tplFactureRappel }, { formatEuros }] = await Promise.all([
    import("@/lib/invoicing/pdf"), import("@/lib/mail"),
    import("@/lib/mail-templates"), import("@/lib/invoicing/types"),
  ]);

  const settingsCache = new Map<string, InvoiceSettings>();
  async function settingsFor(orgId: string): Promise<InvoiceSettings> {
    if (settingsCache.has(orgId)) return settingsCache.get(orgId)!;
    const { data } = await admin!.from("invoice_settings").select("*").eq("organization_id", orgId).maybeSingle();
    const s = (data as InvoiceSettings) ?? ({
      organization_id: orgId, issuer_name: null, issuer_address: null, siret: null, vat_number: null,
      email: null, phone: null, iban: null, bic: null, payment_terms_days: 30, late_penalty: null,
      accent_color: "#FF8A65", footer_mentions: null, number_prefix: "FAC-", logo_url: null, updated_at: today,
    } as InvoiceSettings);
    settingsCache.set(orgId, s);
    return s;
  }

  let reminded = 0;
  for (const inv of overdue as Invoice[]) {
    // Marque en retard
    if (inv.status !== "en_retard") {
      await admin.from("invoices").update({ status: "en_retard" }).eq("id", inv.id);
    }
    if (!inv.client_email) continue;
    const set = await settingsFor(inv.organization_id);
    try {
      const pdf = await renderInvoicePdf(inv, set);
      const ok = await sendMail({
        to: inv.client_email,
        subject: `Rappel — Facture ${inv.number} en attente · ${set.issuer_name ?? "Casa Minga"}`,
        html: tplFactureRappel({
          orgName: set.issuer_name ?? "Casa Minga Lieux",
          clientName: inv.client_name,
          invoiceNumber: inv.number!,
          amountTtc: formatEuros(inv.total_ttc),
          dueDate: inv.due_date
            ? new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
            : "—",
          iban: set.iban,
          isReminder: true,
        }),
        replyTo: set.email ?? undefined,
        attachments: [{ filename: `${inv.number}.pdf`, content: pdf, contentType: "application/pdf" }],
      });
      if (ok) reminded++;
    } catch {
      /* on continue */
    }
  }

  await logCronRun("payment-reminders", "ok", { rowsAffected: reminded });
  return NextResponse.json({ ok: true, overdue: overdue.length, reminded });
}
