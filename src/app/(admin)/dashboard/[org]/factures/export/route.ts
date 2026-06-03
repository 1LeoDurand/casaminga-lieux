import { NextResponse } from "next/server";
import { getOrganizationBySlug } from "@/lib/data";
import { getInvoices } from "@/lib/invoicing/data";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) return new NextResponse("Not found", { status: 404 });

  const invoices = await getInvoices(organization.id);

  const header = ["Numéro", "Type", "Date", "Échéance", "Client", "Email", "Total HT", "TVA", "Total TTC", "Statut"];
  const rows = invoices
    .filter((i) => i.number)
    .map((i) =>
      [
        i.number, i.kind, i.issue_date, i.due_date, i.client_name, i.client_email,
        i.total_ht.toFixed(2), i.total_vat.toFixed(2), i.total_ttc.toFixed(2), i.status,
      ].map(csvCell).join(";")
    );

  const csv = "﻿" + [header.join(";"), ...rows].join("\n");
  const filename = `factures-${org}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
