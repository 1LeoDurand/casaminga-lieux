"use server";

import { revalidatePath } from "next/cache";
import {
  createPerson,
  deletePerson,
  updatePerson,
  type PersonInput,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/personnes`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createPersonAction(
  orgSlug: string,
  input: PersonInput
): Promise<{ ok: boolean }> {
  const ok = await createPerson(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updatePersonAction(
  orgSlug: string,
  id: string,
  patch: Partial<PersonInput>
): Promise<{ ok: boolean }> {
  const ok = await updatePerson(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deletePersonAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deletePerson(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
