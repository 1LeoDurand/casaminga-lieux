"use server";

import { loadPublicSite } from "@/lib/site-public/page-data";
import { signOptinToken, normalizeEmail } from "@/lib/newsletter/optin-token";
import { sendMail } from "@/lib/mail";
import { tplNewsletterConfirm } from "@/lib/mail-templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inscription newsletter depuis le site public — étape 1/2 (double opt-in).
 * Envoie un email de confirmation ; aucune fiche n'est créée tant que le
 * destinataire n'a pas cliqué. Réponse TOUJOURS neutre (anti-énumération) :
 * on ne révèle jamais si l'email ou le lieu existe.
 */
export async function subscribeNewsletterAction(
  slug: string,
  emailRaw: string
): Promise<{ ok: true }> {
  const email = normalizeEmail(emailRaw || "");
  if (!EMAIL_RE.test(email)) return { ok: true };

  const data = await loadPublicSite(slug);
  if (!data) return { ok: true };

  const token = signOptinToken(slug, email);
  if (!token) return { ok: true }; // secret non configuré → dégrade proprement

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com").replace(/\/$/, "");
  const confirmUrl = `${appBase}/newsletter/confirmer/${token}`;

  await sendMail({
    to: email,
    subject: `Confirmez votre inscription à la newsletter de ${data.displayName}`,
    html: tplNewsletterConfirm({ orgName: data.displayName, confirmUrl }),
    category: "newsletter-optin",
    organizationId: data.org.id,
  });

  return { ok: true };
}
