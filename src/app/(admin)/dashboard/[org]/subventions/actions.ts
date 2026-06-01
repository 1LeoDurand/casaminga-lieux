"use server";
import { revalidatePath } from "next/cache";
import {
  createGrant, updateGrant, deleteGrant,
  createGrantTranche, updateGrantTranche, deleteGrantTranche,
  type GrantInput, type GrantTrancheInput,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/subventions`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createGrantAction(orgSlug: string, input: GrantInput) {
  const id = await createGrant(input);
  if (id) refresh(orgSlug);
  return { ok: !!id };
}

export async function updateGrantAction(orgSlug: string, id: string, patch: Partial<GrantInput>) {
  const ok = await updateGrant(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteGrantAction(orgSlug: string, id: string) {
  const ok = await deleteGrant(id);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function createGrantTrancheAction(orgSlug: string, input: GrantTrancheInput) {
  const ok = await createGrantTranche(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updateGrantTrancheAction(orgSlug: string, id: string, patch: Partial<GrantTrancheInput>) {
  const ok = await updateGrantTranche(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteGrantTrancheAction(orgSlug: string, id: string) {
  const ok = await deleteGrantTranche(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
