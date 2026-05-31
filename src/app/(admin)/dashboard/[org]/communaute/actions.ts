"use server";
import { revalidatePath } from "next/cache";
import { createCommunityPost, deleteCommunityPost, updateCommunityPost, type CommunityPostInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/communaute`); }
export async function createCommunityPostAction(orgSlug: string, input: CommunityPostInput): Promise<{ ok: boolean }> {
  const ok = await createCommunityPost(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateCommunityPostAction(orgSlug: string, id: string, patch: Partial<CommunityPostInput>): Promise<{ ok: boolean }> {
  const ok = await updateCommunityPost(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteCommunityPostAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteCommunityPost(id); if (ok) refresh(orgSlug); return { ok };
}
