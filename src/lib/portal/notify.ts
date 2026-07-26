/**
 * Briques partagées de la règle « emails actionnables » (cf. CLAUDE.md).
 *
 * Deux besoins reviennent dans chaque relance actionnable :
 *  - fabriquer le lien signé qui laisse le destinataire agir sans compte ;
 *  - prévenir l'équipe du lieu une fois qu'il a agi.
 *
 * Les deux échouent en silence par construction : un lien manquant fait partir
 * l'email sans bouton, une notification ratée ne doit jamais annuler le geste
 * du client (qui, lui, est déjà enregistré en base).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPortalToken } from "@/lib/portal/token";

export const APP_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

/**
 * URL du portail permettant d'agir sur un objet précis.
 * Retourne null si PORTAL_LINK_SECRET est absent : l'appelant envoie alors
 * l'email sans le bouton plutôt que de planter.
 */
export function portalActionUrl(email: string | null | undefined, path: string): string | null {
  if (!email) return null;
  try {
    // signPortalToken lève si PORTAL_LINK_SECRET n'est pas posé.
    return `${APP_BASE}/espace/${signPortalToken(email)}/${path.replace(/^\//, "")}`;
  } catch {
    return null;
  }
}

/** Emails des admins actifs d'une org (destinataires des alertes équipe). */
export async function orgAdminEmails(
  admin: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const { data } = await admin
    .from("organization_members")
    .select("profiles(email)")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .eq("status", "actif");
  return (data ?? [])
    .map((m) => (m.profiles as unknown as { email: string | null } | null)?.email)
    .filter((e): e is string => !!e);
}

/**
 * Prévient l'équipe qu'un destinataire a agi depuis un email.
 * Ne lève jamais : l'action du client est déjà écrite en base au moment de l'appel.
 */
export async function notifyOrgAdmins(
  admin: SupabaseClient,
  organizationId: string,
  build: (org: { name: string; slug: string }) => { subject: string; html: string; category: string }
): Promise<void> {
  try {
    const [{ data: org }, emails] = await Promise.all([
      admin.from("organizations").select("name, slug").eq("id", organizationId).maybeSingle(),
      orgAdminEmails(admin, organizationId),
    ]);
    if (emails.length === 0) return;

    const { subject, html, category } = build({
      name: org?.name ?? "Votre lieu",
      slug: org?.slug ?? "",
    });
    const { sendMail } = await import("@/lib/mail");
    await sendMail({ to: emails, subject, html, category, organizationId });
  } catch {
    /* la notification ne doit jamais bloquer l'action du client */
  }
}
