"use server";

import { revalidatePath } from "next/cache";
import {
  createSpace,
  deleteSpace,
  updateSpace,
  type SpaceInput,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/espaces`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createSpaceAction(
  orgSlug: string,
  input: SpaceInput
): Promise<{ ok: boolean }> {
  const ok = await createSpace(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updateSpaceAction(
  orgSlug: string,
  id: string,
  patch: Partial<SpaceInput>
): Promise<{ ok: boolean }> {
  const ok = await updateSpace(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteSpaceAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deleteSpace(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
