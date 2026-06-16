import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/lib/data";
import { getCoordinationNote } from "@/lib/coordination/data";
import { generateNoteDocx } from "@/lib/coordination/docx";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> },
) {
  const { org, id } = await params;

  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const note = await getCoordinationNote(id);
  if (!note || note.organization_id !== organization.id) notFound();

  const buffer = await generateNoteDocx(note, organization.name);
  const slug = note.title.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug || "note-coordination"}.docx"`,
    },
  });
}
