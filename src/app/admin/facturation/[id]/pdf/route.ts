import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getSaInvoiceById, getSaSettings } from "@/lib/superadmin-billing/data";
import { renderSaInvoicePdf } from "@/lib/superadmin-billing/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const [invoice, settings] = await Promise.all([getSaInvoiceById(id), getSaSettings()]);
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderSaInvoicePdf(invoice, settings);
  const filename = `${invoice.number ?? "brouillon"}.pdf`;
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
