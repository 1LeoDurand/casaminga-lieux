"use server";
import { revalidatePath } from "next/cache";
import { createPartner, deletePartner, updatePartner, type PartnerInput } from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/partenaires`); }
export async function createPartnerAction(orgSlug: string, input: PartnerInput): Promise<{ ok: boolean }> {
  const ok = await createPartner(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updatePartnerAction(orgSlug: string, id: string, patch: Partial<PartnerInput>): Promise<{ ok: boolean }> {
  const ok = await updatePartner(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deletePartnerAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deletePartner(id); if (ok) refresh(orgSlug); return { ok };
}
