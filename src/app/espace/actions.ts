"use server";

import { sendMail } from "@/lib/mail";
import { emailHasPortalContent } from "@/lib/portal/data";
import { portalUrlForEmail } from "@/lib/portal/url";
import { tplPortalLink } from "@/lib/mail-templates";
import { normalizeEmail } from "@/lib/portal/token";

/**
 * Demande de lien espace adhérent.
 * Retourne TOUJOURS { ok: true } (anti-énumération) — même si l'email est inconnu.
 * Si PORTAL_LINK_SECRET n'est pas défini, on dégrade silencieusement.
 */
export async function requestPortalLinkAction(
  _prev: { ok: boolean },
  formData: FormData
): Promise<{ ok: boolean }> {
  const rawEmail = (formData.get("email") as string | null)?.trim() ?? "";
  if (!rawEmail || !rawEmail.includes("@")) return { ok: true };

  const secret = process.env.PORTAL_LINK_SECRET;
  if (!secret) {
    // Mode démo / env incomplet — ne pas crasher
    return { ok: true };
  }

  try {
    const email = normalizeEmail(rawEmail);

    // Anti-spam : 3 envois de lien max / email / heure (réponse neutre identique)
    const { rateLimit } = await import("@/lib/rate-limit");
    if (!rateLimit(`portal-link:${email}`, 3, 3_600_000)) return { ok: true };

    const hasContent = await emailHasPortalContent(email);
    if (!hasContent) return { ok: true };

    const url = portalUrlForEmail(email);

    // Tenter de trouver le prénom depuis la fiche persons (best-effort)
    let firstName = "";
    try {
      const { createAdminClient } = await import("@/lib/admin/guard");
      const admin = createAdminClient();
      if (admin) {
        const { data } = await admin
          .from("persons")
          .select("name")
          .ilike("email", email)
          .is("anonymized_at", null)
          .limit(1)
          .maybeSingle();
        if (data?.name) {
          firstName = data.name.split(" ")[0] ?? "";
        }
      }
    } catch {
      // silence — prénom optionnel
    }

    await sendMail({
      to: rawEmail,
      subject: "Votre espace adhérent Casa Minga",
      html: tplPortalLink({ firstName, portalUrl: url }),
      category: "espace-adherent",
    });
  } catch {
    // Fail silently — toujours retourner ok: true (anti-énumération)
  }

  return { ok: true };
}
