"use server";

import { revalidatePath } from "next/cache";
import { createEvenement, deleteEvenement, updateEvenement, type EvenementInput } from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createEvenementAction(orgSlug: string, input: EvenementInput): Promise<{ ok: boolean }> {
  const ok = await createEvenement(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updateEvenementAction(orgSlug: string, id: string, patch: Partial<EvenementInput>): Promise<{ ok: boolean }> {
  const ok = await updateEvenement(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteEvenementAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteEvenement(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
