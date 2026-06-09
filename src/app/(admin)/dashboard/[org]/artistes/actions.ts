"use server";
import { revalidatePath } from "next/cache";
import {
  createArtist, updateArtist, deleteArtist,
  createMilestone, updateMilestone, deleteMilestone,
  type ArtistInput, type ArtistMilestoneInput,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/residences`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createArtistAction(orgSlug: string, input: ArtistInput) {
  const id = await createArtist(input);
  if (id) refresh(orgSlug);
  return { ok: !!id };
}

export async function updateArtistAction(orgSlug: string, id: string, patch: Partial<ArtistInput>) {
  const ok = await updateArtist(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteArtistAction(orgSlug: string, id: string) {
  const ok = await deleteArtist(id);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function createMilestoneAction(orgSlug: string, input: ArtistMilestoneInput) {
  const ok = await createMilestone(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updateMilestoneAction(orgSlug: string, id: string, patch: Partial<ArtistMilestoneInput>) {
  const ok = await updateMilestone(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteMilestoneAction(orgSlug: string, id: string) {
  const ok = await deleteMilestone(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
