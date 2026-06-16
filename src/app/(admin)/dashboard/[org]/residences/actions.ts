"use server";
import { revalidatePath } from "next/cache";
import {
  createResidence, deleteResidence, updateResidence, type ResidenceInput,
  createMilestone, updateMilestone, deleteMilestone, type ArtistMilestoneInput,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/residences`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createResidenceAction(orgSlug: string, input: ResidenceInput): Promise<{ ok: boolean }> {
  const ok = await createResidence(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateResidenceAction(orgSlug: string, id: string, patch: Partial<ResidenceInput>): Promise<{ ok: boolean }> {
  const ok = await updateResidence(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteResidenceAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteResidence(id); if (ok) refresh(orgSlug); return { ok };
}

export async function createMilestoneAction(input: ArtistMilestoneInput): Promise<{ ok: boolean }> {
  return { ok: await createMilestone(input) };
}
export async function updateMilestoneAction(id: string, patch: Partial<ArtistMilestoneInput>): Promise<{ ok: boolean }> {
  return { ok: await updateMilestone(id, patch) };
}
export async function deleteMilestoneAction(id: string): Promise<{ ok: boolean }> {
  return { ok: await deleteMilestone(id) };
}
