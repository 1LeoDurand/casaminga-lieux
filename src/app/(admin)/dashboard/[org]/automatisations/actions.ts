"use server";
import { revalidatePath } from "next/cache";
import { createAutomation, deleteAutomation, updateAutomation, type AutomationInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/automatisations`); }
export async function createAutomationAction(orgSlug: string, input: AutomationInput): Promise<{ ok: boolean }> {
  const ok = await createAutomation(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateAutomationAction(orgSlug: string, id: string, patch: Partial<AutomationInput>): Promise<{ ok: boolean }> {
  const ok = await updateAutomation(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteAutomationAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteAutomation(id); if (ok) refresh(orgSlug); return { ok };
}
