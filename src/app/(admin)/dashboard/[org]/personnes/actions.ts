"use server";

import { revalidatePath } from "next/cache";
import {
  createPerson,
  deletePerson,
  updatePerson,
  anonymizePerson,
  getOrganizationBySlug,
  type PersonInput,
} from "@/lib/data";
import { publicSiteUrl } from "@/lib/site-public/url";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/personnes`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createPersonAction(
  orgSlug: string,
  input: PersonInput,
  sendWelcome = false
): Promise<{ ok: boolean }> {
  const ok = await createPerson(input);
  if (ok) {
    refresh(orgSlug);
    // Email de bienvenue (opt-in, non bloquant)
    if (sendWelcome && input.email) {
      void (async () => {
        try {
          const [org, { sendMail }, { tplPersonneBienvenue }] = await Promise.all([
            getOrganizationBySlug(orgSlug),
            import("@/lib/mail"),
            import("@/lib/mail-templates"),
          ]);
          await sendMail({
            to: input.email!,
            subject: `Bienvenue · ${org?.name ?? "Casa Minga Lieux"}`,
            html: tplPersonneBienvenue({
              orgName: org?.name ?? "Casa Minga Lieux",
              firstName: input.name.split(" ")[0],
              role: input.role,
              siteUrl: org?.slug ? publicSiteUrl(org.slug) : undefined,
            }),
            category: "bienvenue",
            organizationId: input.organization_id,
          });
        } catch (e) {
          console.error("[bienvenue CRM] échec envoi:", e);
        }
      })();
    }
  }
  return { ok };
}

export async function updatePersonAction(
  orgSlug: string,
  id: string,
  patch: Partial<PersonInput>
): Promise<{ ok: boolean }> {
  const ok = await updatePerson(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deletePersonAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deletePerson(id);
  if (ok) refresh(orgSlug);
  return { ok };
}

/**
 * RGPD — Droit à l'oubli.
 * Anonymise les données personnelles identifiables d'un profil CRM.
 * Les liens vers les documents financiers (factures, caisse) sont conservés
 * pour conformité comptable (obligation légale 10 ans) mais sans PII.
 */
export async function anonymizePersonAction(
  orgSlug: string,
  id: string,
  operatorName: string,
): Promise<{ ok: boolean }> {
  const ok = await anonymizePerson(id, operatorName);
  if (ok) refresh(orgSlug);
  return { ok };
}

// ── Espace adhérent (portail) ─────────────────────────────────────────────────

/**
 * Envoie le lien espace adhérent à l'email de la fiche.
 * Retourne toujours { ok: true } pour masquer les erreurs éventuelles.
 */
export async function sendPortalLinkAction(
  orgSlug: string,
  personEmail: string,
  personName: string,
  establishmentName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.PORTAL_LINK_SECRET;
  if (!secret) return { ok: false, error: "PORTAL_LINK_SECRET non configuré" };

  try {
    const [org, { sendMail }, { tplPortalLink }, { portalUrlForEmail }] = await Promise.all([
      getOrganizationBySlug(orgSlug),
      import("@/lib/mail"),
      import("@/lib/mail-templates"),
      import("@/lib/portal/url"),
    ]);
    const orgName = org?.name ?? "Casa Minga";

    const url = portalUrlForEmail(personEmail);
    const firstName = personName.split(" ")[0] ?? personName;
    const sent = await sendMail({
      to: personEmail,
      subject: `Votre espace adhérent · ${orgName}`,
      html: tplPortalLink({ firstName, portalUrl: url, orgName, establishmentName }),
      category: "espace-adherent",
      organizationId: org?.id,
    });
    return sent ? { ok: true } : { ok: false, error: "Erreur d'envoi email" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Génère le lien espace adhérent sans envoyer d'email (pour copier dans le presse-papier).
 */
export async function getPortalLinkAction(
  personEmail: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const secret = process.env.PORTAL_LINK_SECRET;
  if (!secret) return { ok: false, error: "PORTAL_LINK_SECRET non configuré" };

  try {
    const { portalUrlForEmail } = await import("@/lib/portal/url");
    const url = portalUrlForEmail(personEmail);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
