"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { clientIp, resolveContactToken } from "@/lib/outreach/link-token";
import { cleanCorrectionText, recordCorrection } from "@/lib/outreach/correction";
import { notifyLinkAction } from "@/lib/outreach/link-notify";

/**
 * Signalement d'une erreur depuis le lien signé. Le jeton est revérifié ici :
 * la page n'est pas une preuve. Toute issue redirige vers la page (`?r=`),
 * qui répond « lien invalide » si le jeton ne vaut plus.
 */
export async function submitCorrectionAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").slice(0, 256);
  const back = (code?: string): never =>
    redirect(`/contact/${encodeURIComponent(token)}/correction${code ? `?r=${code}` : ""}`);

  const link = await resolveContactToken(token, "correction", { ip: clientIp(await headers()) });
  if (!link) return back();

  const cleaned = cleanCorrectionText(formData.get("text"));
  if (!cleaned.ok) return back(cleaned.error);

  const admin = createAdminClient();
  if (!admin) return back("server");

  const result = await recordCorrection(admin, {
    thread: link.thread,
    stages: link.stages,
    fromEmail: link.addressEmail,
    text: cleaned.text,
  });
  if (!result.messageId) return back("server");

  after(() =>
    notifyLinkAction({
      threadId: link.thread.id,
      placeName: link.contact.name,
      headline: "Correction signalée",
      detail: "Un lieu signale une erreur dans l'article. Le message est dans le fil, à traiter par vous.",
    })
  );

  return back("ok");
}
