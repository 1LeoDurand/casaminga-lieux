import { notFound } from "next/navigation";
import {
  getOrganizationBySlug,
  getMeetingsForOrg,
  getResolutionsForMeeting,
  getAssemblyAttendance,
  getPersonsForOrg,
} from "@/lib/data";
import { renderPVPdf } from "@/lib/governance-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> },
) {
  const { org, id } = await params;

  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [meetings, resolutions, attendance, persons] = await Promise.all([
    getMeetingsForOrg(organization.id),
    getResolutionsForMeeting(id),
    getAssemblyAttendance(id),
    getPersonsForOrg(organization.id),
  ]);

  const meeting = meetings.find((m) => m.id === id);
  if (!meeting) notFound();

  const pdf = await renderPVPdf({ org: organization, meeting, resolutions, attendance, persons });

  const slug = meeting.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pv-${slug}.pdf"`,
    },
  });
}
