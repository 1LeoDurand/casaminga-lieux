import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/lib/data";
import { getCoordinationNote } from "@/lib/coordination/data";
import { CoordinationNoteEditor } from "@/components/mc/coordination-note-editor";

export const dynamic = "force-dynamic";

export default async function CoordinationNotePage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const note = await getCoordinationNote(id);
  if (!note || note.organization_id !== organization.id) notFound();

  return <CoordinationNoteEditor note={note} orgSlug={organization.slug} />;
}
