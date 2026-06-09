import { NextResponse } from "next/server";
import { getOrganizationBySlug, getCashEntryById, getPersonsForOrg } from "@/lib/data";
import { renderCashTicketPdf } from "@/lib/cash-ticket-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) return new NextResponse("Not found", { status: 404 });

  const entry = await getCashEntryById(organization.id, id);
  if (!entry) return new NextResponse("Not found", { status: 404 });

  // Résolution du nom du client lié (optionnel)
  let personName: string | null = null;
  if (entry.person_id) {
    const persons = await getPersonsForOrg(organization.id);
    personName = persons.find((p) => p.id === entry.person_id)?.name ?? null;
  }

  const pdf = await renderCashTicketPdf(entry, organization, personName);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${entry.ticket_ref}.pdf"`,
    },
  });
}
