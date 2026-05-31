"use server";
import { revalidatePath } from "next/cache";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement, type AnnouncementInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/communication`); }
export async function createAnnouncementAction(orgSlug: string, input: AnnouncementInput): Promise<{ ok: boolean }> {
  const ok = await createAnnouncement(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateAnnouncementAction(orgSlug: string, id: string, patch: Partial<AnnouncementInput>): Promise<{ ok: boolean }> {
  const ok = await updateAnnouncement(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteAnnouncementAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteAnnouncement(id); if (ok) refresh(orgSlug); return { ok };
}
