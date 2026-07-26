"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { verifyPortalToken } from "@/lib/portal/token";

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

const METHOD_LABELS: Record<string, string> = {
  virement: "Virement bancaire",
  cheque: "Chèque",
  especes: "Espèces",
  prelevement: "Prélèvement automatique",
  autre: "Autre",
};

/**
 * Déclaration de paiement par le client depuis son portail (lien signé, sans compte).
 *
 * Règle « emails actionnables » : la déclaration ARRÊTE les relances et NOTIFIE
 * l'équipe, mais n'écrit PAS le statut « payée » — seule une vérification humaine
 * fait foi côté comptabilité. Voir src/app/api/cron/payment-reminders/route.ts.
 */
export async function declarePaymentAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const method = String(formData.get("method") ?? "virement");
  const paidOn = String(formData.get("paidOn") ?? "").slice(0, 10);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const email = verifyPortalToken(token);
  if (!email || !invoiceId) redirect(`/espace/${token}/facture/${invoiceId}?error=1`);

  const admin = createAdminClient();
  if (!admin) redirect(`/espace/${token}/facture/${invoiceId}?error=1`);

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, number, client_email, client_name, total_ttc, status, organization_id, payment_declared_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) redirect(`/espace/${token}/facture/${invoiceId}?error=1`);

  // La facture doit appartenir au porteur du token (même règle que /recu/[id]).
  if ((invoice.client_email ?? "").toLowerCase() !== email) {
    redirect(`/espace/${token}/facture/${invoiceId}?error=forbidden`);
  }

  // Idempotent : déjà déclarée ou déjà payée → on renvoie sur la confirmation.
  if (invoice.payment_declared_at || invoice.status === "payee") {
    redirect(`/espace/${token}/facture/${invoiceId}?done=1`);
  }

  const declaredDate = /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? paidOn : new Date().toISOString().slice(0, 10);

  await admin
    .from("invoices")
    .update({
      payment_declared_at: new Date().toISOString(),
      payment_declared_method: method,
      payment_declared_date: declaredDate,
      payment_declared_note: note || null,
    })
    .eq("id", invoiceId);

  // ── Notifier l'équipe du lieu (jamais bloquant) ──
  try {
    const [{ data: org }, { data: members }] = await Promise.all([
      admin.from("organizations").select("name, slug").eq("id", invoice.organization_id).maybeSingle(),
      admin
        .from("organization_members")
        .select("profiles(email)")
        .eq("organization_id", invoice.organization_id)
        .eq("role", "admin")
        .eq("status", "actif"),
    ]);

    const emails = (members ?? [])
      .map((m) => (m.profiles as unknown as { email: string | null } | null)?.email)
      .filter((e): e is string => !!e);

    if (emails.length > 0) {
      const [{ sendMail }, { tplPaiementDeclare }, { formatEuros }] = await Promise.all([
        import("@/lib/mail"),
        import("@/lib/mail-templates"),
        import("@/lib/invoicing/types"),
      ]);
      await sendMail({
        to: emails,
        subject: `À vérifier — ${invoice.client_name} déclare avoir réglé la facture ${invoice.number}`,
        html: tplPaiementDeclare({
          orgName: org?.name ?? "Votre lieu",
          clientName: invoice.client_name,
          invoiceNumber: invoice.number ?? "—",
          amountTtc: formatEuros(invoice.total_ttc),
          method: METHOD_LABELS[method] ?? method,
          paidOn: new Date(declaredDate).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "long", year: "numeric",
          }),
          note: note || null,
          dashboardUrl: `${APP_BASE}/dashboard/${org?.slug ?? ""}/factures`,
        }),
        category: "facture",
        organizationId: invoice.organization_id,
      });
    }
  } catch {
    /* la notification ne doit jamais bloquer la déclaration */
  }

  redirect(`/espace/${token}/facture/${invoiceId}?done=1`);
}
