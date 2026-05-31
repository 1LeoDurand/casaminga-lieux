"use server";
import { revalidatePath } from "next/cache";
import { createDocument, deleteDocument, updateDocument, type DocumentInput } from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/documents`);
}

export async function createDocumentAction(orgSlug: string, input: DocumentInput): Promise<{ ok: boolean }> {
  const ok = await createDocument(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateDocumentAction(orgSlug: string, id: string, patch: Partial<DocumentInput>): Promise<{ ok: boolean }> {
  const ok = await updateDocument(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteDocumentAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteDocument(id); if (ok) refresh(orgSlug); return { ok };
}
