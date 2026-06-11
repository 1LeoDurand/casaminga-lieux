"use server";
import { headers } from "next/headers";
import { getDocumentBySigningToken, markDocumentSignedInDB } from "@/lib/data";

export async function confirmSignatureAction(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const doc = await getDocumentBySigningToken(token);
  if (!doc) return { ok: false, error: "Ce lien de signature est invalide ou a déjà été utilisé." };

  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

  const ok = await markDocumentSignedInDB(doc.id, ip);
  if (!ok) return { ok: false, error: "Erreur lors de l'enregistrement de la signature." };

  return { ok: true };
}
