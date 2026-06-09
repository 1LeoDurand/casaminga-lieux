import { NextResponse } from "next/server";
import {
  getOrganizationBySlug,
  getCashClosureById,
  getCashEntriesForClosure,
} from "@/lib/data";
import { renderCashClosurePdf } from "@/lib/cash-closure-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) return new NextResponse("Not found", { status: 404 });

  const closure = await getCashClosureById(organization.id, id);
  if (!closure) return new NextResponse("Not found", { status: 404 });

  // Charger les écritures de la période couverte
  const entries =
    closure.first_entry_seq !== null && closure.last_entry_seq !== null
      ? await getCashEntriesForClosure(
          organization.id,
          closure.first_entry_seq,
          closure.last_entry_seq
        )
      : [];

  const pdf = await renderCashClosurePdf(closure, entries, organization);

  const typeCode = closure.closure_type === "jour" ? "Z" : closure.closure_type === "mois" ? "M" : "A";
  const filename = `rapport-${typeCode}-${closure.seq}-${closure.period_label.replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
