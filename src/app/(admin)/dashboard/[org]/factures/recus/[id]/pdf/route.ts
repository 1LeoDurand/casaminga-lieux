import { NextResponse } from "next/server";
import { getTaxReceiptById } from "@/lib/tax-receipts/data";
import { getInvoiceSettings } from "@/lib/invoicing/data";
import { renderTaxReceiptPdf } from "@/lib/tax-receipts/pdf";
import { getOrganizationBySlug } from "@/lib/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> },
) {
  const { org, id } = await params;

  const organization = await getOrganizationBySlug(org);
  if (!organization) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const [receipt, settings] = await Promise.all([
    getTaxReceiptById(id),
    getInvoiceSettings(organization.id),
  ]);
  if (!receipt) return NextResponse.json({ error: "receipt not found" }, { status: 404 });

  const buffer = await renderTaxReceiptPdf(receipt, settings);
  const filename = `recu-fiscal-${receipt.number ?? receipt.id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
