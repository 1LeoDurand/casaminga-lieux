"use server";
import { revalidatePath } from "next/cache";
import { createImpactIndicator, deleteImpactIndicator, updateImpactIndicator, type ImpactIndicatorInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/impact`); }
export async function createImpactAction(orgSlug: string, input: ImpactIndicatorInput): Promise<{ ok: boolean }> {
  const ok = await createImpactIndicator(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateImpactAction(orgSlug: string, id: string, patch: Partial<ImpactIndicatorInput>): Promise<{ ok: boolean }> {
  const ok = await updateImpactIndicator(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteImpactAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteImpactIndicator(id); if (ok) refresh(orgSlug); return { ok };
}
