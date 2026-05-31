"use server";
import { revalidatePath } from "next/cache";
import { createTransaction, deleteTransaction, updateTransaction, type TransactionInput } from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/finances`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createTransactionAction(orgSlug: string, input: TransactionInput): Promise<{ ok: boolean }> {
  const ok = await createTransaction(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateTransactionAction(orgSlug: string, id: string, patch: Partial<TransactionInput>): Promise<{ ok: boolean }> {
  const ok = await updateTransaction(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteTransactionAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteTransaction(id); if (ok) refresh(orgSlug); return { ok };
}
