import { NextResponse } from "next/server";
import { getOrganizationBySlug } from "@/lib/data";
import { getInvoiceById, getInvoiceSettings } from "@/lib/invoicing/data";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) return new NextResponse("Not found", { status: 404 });

  const [invoice, settings] = await Promise.all([
    getInvoiceById(organization.id, id),
    getInvoiceSettings(organization.id),
  ]);
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(invoice, settings);
  const filename = `${invoice.number ?? "brouillon"}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
