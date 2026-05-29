"use server";

import { revalidatePath } from "next/cache";
import { updateRequestStatus } from "@/lib/data";
import type { RequestStatus } from "@/lib/types";

/** Change le statut d'une demande puis rafraîchit la page Demandes. */
export async function setRequestStatus(
  orgSlug: string,
  id: string,
  status: RequestStatus
): Promise<{ ok: boolean }> {
  const ok = await updateRequestStatus(id, status);
  if (ok) {
    revalidatePath(`/dashboard/${orgSlug}/demandes`);
    revalidatePath(`/dashboard/${orgSlug}`);
  }
  return { ok };
}
