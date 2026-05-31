"use server";
import { revalidatePath } from "next/cache";
import { createMedia, deleteMedia, updateMedia, type MediaInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/mediatheque`); }
export async function createMediaAction(orgSlug: string, input: MediaInput): Promise<{ ok: boolean }> {
  const ok = await createMedia(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateMediaAction(orgSlug: string, id: string, patch: Partial<MediaInput>): Promise<{ ok: boolean }> {
  const ok = await updateMedia(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteMediaAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteMedia(id); if (ok) refresh(orgSlug); return { ok };
}
