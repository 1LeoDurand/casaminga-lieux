/**
 * Demande de lien d'espace adhérent, partagée par le formulaire /espace
 * (action serveur) et par POST /api/espace/lien (casaminga.com).
 *
 * Contrat anti-énumération : l'appelant répond la même chose quoi qu'il
 * arrive (courriel connu, inconnu, invalide, limite atteinte, secret absent).
 * Cette fonction ne renvoie donc rien.
 */
import "server-only";
import { after } from "next/server";
import { sendMail } from "@/lib/mail";
import { emailHasPortalContent, exactEmailPattern } from "@/lib/portal/data";
import { portalUrlForEmail, type PortalReturn } from "@/lib/portal/url";
import { tplPortalLink } from "@/lib/mail-templates";
import { normalizeEmail, PORTAL_TOKEN_TTL_MS } from "@/lib/portal/token";
import { rateLimit } from "@/lib/rate-limit";

/** 3 liens par courriel et par heure : assez pour un lien perdu, pas pour inonder une boîte. */
const LINKS_PER_EMAIL_PER_HOUR = 3;

export async function requestPortalLink(rawInput: unknown, retour: PortalReturn): Promise<void> {
  const rawEmail = typeof rawInput === "string" ? rawInput.trim() : "";
  // 254 : longueur maximale d'une adresse (RFC 5321).
  if (!rawEmail || rawEmail.length > 254 || !rawEmail.includes("@")) return;

  // Sans secret, pas de lien possible : on dégrade en silence plutôt que de planter.
  if (!process.env.PORTAL_LINK_SECRET) return;

  const email = normalizeEmail(rawEmail);
  if (!rateLimit(`portal-link:${email}`, LINKS_PER_EMAIL_PER_HOUR, 3_600_000)) return;

  // La recherche en base et l'envoi partent après la réponse : un courriel
  // connu (lecture + envoi SMTP) répondrait sinon nettement plus lentement
  // qu'un inconnu, et ce délai suffirait à savoir qui a un dossier.
  after(async () => {
    try {
      const hasContent = await emailHasPortalContent(email);
      if (!hasContent) return;

      const url = portalUrlForEmail(email, retour);

      // Prénom depuis la fiche persons, au mieux : le courriel part sans s'il manque.
      let firstName = "";
      try {
        const { createAdminClient } = await import("@/lib/admin/guard");
        const admin = createAdminClient();
        if (admin) {
          const { data } = await admin
            .from("persons")
            .select("name, email")
            .ilike("email", exactEmailPattern(email))
            .is("anonymized_at", null)
            .limit(5);
          const row = (data ?? []).find((p) => normalizeEmail(p.email ?? "") === email);
          if (row?.name) firstName = row.name.split(" ")[0] ?? "";
        }
      } catch {
        // prénom facultatif
      }

      await sendMail({
        to: email,
        subject: "Votre espace adhérent Casa Minga",
        html: tplPortalLink({
          firstName,
          portalUrl: url,
          validityDays: Math.round(PORTAL_TOKEN_TTL_MS / 86_400_000),
        }),
        category: "espace-adherent",
      });
    } catch {
      // Rien ne remonte : la réponse est déjà partie, et elle est neutre.
    }
  });
}
