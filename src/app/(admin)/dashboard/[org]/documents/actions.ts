"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createDocument, deleteDocument, updateDocument, type DocumentInput, getDocumentsForOrg, getPersonsForOrg } from "@/lib/data";
import { sendMail } from "@/lib/mail";
import { tplSignatureRequest, tplDocumentSigned } from "@/lib/mail-templates";
import { createClient } from "@/lib/supabase/server";

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

// ── Signature électronique (Lot 9) ──────────────────────────────────────────
export async function sendSignatureRequestAction(
  orgSlug: string,
  orgId: string,
  orgName: string,
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  // Charger le document
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();

  if (!doc) return { ok: false, error: "Document introuvable." };
  if (!doc.person_id) return { ok: false, error: "Aucun signataire associé à ce document." };

  // Charger la personne
  const { data: person } = await supabase
    .from("persons")
    .select("id, name, email")
    .eq("id", doc.person_id)
    .single();

  if (!person?.email) return { ok: false, error: "Le signataire n'a pas d'adresse email." };

  // Générer le token (UUID v4 via crypto)
  const { randomUUID } = await import("crypto");
  const token = randomUUID();

  // Persister le token sur le document
  const { error: updateErr } = await supabase
    .from("documents")
    .update({ signing_token: token, status: "envoye", updated_at: new Date().toISOString() })
    .eq("id", documentId);

  if (updateErr) return { ok: false, error: "Impossible de générer le token." };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://admin.casaminga.com`;
  const signUrl = `${baseUrl}/signer/${token}`;

  const DOCUMENT_TYPE_FR: Record<string, string> = {
    contrat: "Contrat", devis: "Devis", facture: "Facture",
    convention: "Convention", rapport: "Rapport", autre: "Document",
  };

  const sent = await sendMail({
    to: person.email,
    subject: `Document à signer : ${doc.title} — ${orgName}`,
    html: tplSignatureRequest({
      orgName,
      recipientName: person.name,
      documentTitle: doc.title,
      documentType: DOCUMENT_TYPE_FR[doc.type] ?? doc.type,
      signUrl,
    }),
    category: "signature-request",
    organizationId: orgId,
  });

  if (sent) refresh(orgSlug);
  return { ok: sent };
}

// ── Notification admin après signature (appelé depuis /signer) ───────────────
export async function notifySignedAction(
  orgId: string,
  orgName: string,
  documentTitle: string,
  signerName: string,
  signedAt: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select("notification_email")
    .eq("organization_id", orgId)
    .maybeSingle();

  const adminEmail = settings?.notification_email ?? process.env.MAIL_ADMIN;
  if (!adminEmail) return;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com"}/dashboard`;

  await sendMail({
    to: adminEmail,
    subject: `Document signé : ${documentTitle} — ${orgName}`,
    html: tplDocumentSigned({ orgName, documentTitle, signerName, signedAt, dashboardUrl }),
    category: "document-signed",
    organizationId: orgId,
  });
}
