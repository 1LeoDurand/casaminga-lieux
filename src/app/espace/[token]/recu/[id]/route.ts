import { notFound } from "next/navigation";
import { verifyPortalToken } from "@/lib/portal/token";
import { createAdminClient } from "@/lib/admin/guard";
import { getInvoiceSettings } from "@/lib/invoicing/data";
import { renderTaxReceiptPdf } from "@/lib/tax-receipts/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  // Vérification du token HMAC
  const email = verifyPortalToken(token);
  if (!email) return notFound();

  const admin = createAdminClient();
  if (!admin) return notFound();

  // Charger le reçu
  const { data: receipt } = await admin
    .from("tax_receipts")
    .select("id, number, fiscal_year, amount, donation_date, donation_type, organization_id, donor_person_id, donor_name, donor_address, transaction_id, pdf_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!receipt) return notFound();

  // Sécurité : vérifier que le reçu appartient bien à un donateur portant cet email
  if (!receipt.donor_person_id) return new Response(null, { status: 403 });

  const { data: person } = await admin
    .from("persons")
    .select("email")
    .eq("id", receipt.donor_person_id)
    .maybeSingle();

  if (!person?.email || person.email.toLowerCase() !== email) {
    return new Response(null, { status: 403 });
  }

  // Charger les paramètres de l'org et générer le PDF
  const settings = await getInvoiceSettings(receipt.organization_id);
  const buffer = await renderTaxReceiptPdf(receipt, settings);
  const filename = `recu-${receipt.number ?? receipt.id.slice(0, 8)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
