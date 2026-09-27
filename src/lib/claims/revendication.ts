import "server-only";
import { randomBytes } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

/**
 * Le cœur de la revendication, partagé par les deux moments qui la composent.
 *
 * Il y en a deux depuis l'ajout des garde-fous : le DÉPÔT (actions.ts), qui
 * n'écrit qu'une ligne et envoie un lien au demandeur, et la CONFIRMATION
 * (/revendiquer/confirmer/[token]), qui est désormais le seul endroit d'où un
 * courriel peut partir vers un lieu. Tout ce qui touche au lieu vit donc ici,
 * et non plus dans l'action publique.
 *
 * Tout passe par la clé de service : `claims` est fermée à `anon` comme à
 * `authenticated`, et `invitations` ne s'écrit pas depuis un navigateur.
 */

export type Voie = "auto" | "manuel";

/** Un mois, et non les sept jours d'une invitation d'équipe. Le courriel
 *  générique d'une médiathèque ou d'une mairie est relevé une fois par
 *  semaine ; sept jours condamnaient la moitié des invitations. */
export const VALIDITE_JOURS = 30;

/** Le lien de confirmation, lui, s'adresse à quelqu'un qui vient de remplir un
 *  formulaire : deux jours suffisent, et un jeton mort est un jeton qui ne
 *  traîne pas. */
export const CONFIRMATION_HEURES = 48;

/* ── Les seuils des trois garde-fous ───────────────────────────
 *
 * Volontairement hauts pour une personne, bas pour un script. Une médiathèque
 * qui s'y reprend à deux fois ne les voit jamais ; un robot qui balaie les
 * 118 fiches moissonnées bute sur le premier.
 */
/** Dépôts acceptés depuis une même IP en une heure (la rafale). */
export const IP_PAR_HEURE = 5;
/** Dépôts acceptés depuis une même IP en 24 h (compté en base). */
export const IP_PAR_JOUR = 20;
/** Demandes acceptées pour un même lieu en 24 h, confirmées ou non. */
export const LIEU_PAR_JOUR = 3;
/** Courriels envoyés à un même lieu en 7 jours. C'est la limite qui compte
 *  vraiment : elle est vérifiée à l'instant de l'envoi, pas au dépôt. */
export const LIEU_INVITATIONS_7J = 2;
/** Liens de confirmation envoyés à une même adresse en une heure. */
export const EMAIL_PAR_HEURE = 3;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Fabrique du client de service, factorisée pour une raison de typage : passer
 * le client à une fonction annotée `ReturnType<typeof createServiceClient>`
 * fait retomber ses paramètres génériques sur `never`, et toute requête
 * devient inutilisable. Le type dérivé de cette fabrique est concret.
 */
export function serviceClient(url: string, key: string) {
  return createServiceClient(url, key, { auth: { persistSession: false } });
}
export type ServiceClient = ReturnType<typeof serviceClient>;

/** Client de service, ou null si l'environnement est incomplet. */
export function adminClaims(): ServiceClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return serviceClient(SUPABASE_URL, key);
}

/** Masque une adresse : « contact@ville.fr » → « c…t@ville.fr ». */
export function indiceAdresse(email: string): string {
  const [local, domaine] = email.split("@");
  if (!domaine) return "…";
  const masque =
    local.length <= 2 ? `${local[0]}…` : `${local[0]}…${local[local.length - 1]}`;
  return `${masque}@${domaine}`;
}

/** 32 octets d'aléa : un jeton de confirmation ne se devine pas plus qu'un
 *  jeton d'invitation. */
export function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
}

export function confirmationUrl(token: string): string {
  return `${appUrl()}/revendiquer/confirmer/${token}`;
}

/* ══════════════════════════════════════════════════════════════
   Garde-fou n°2 — la limite par lieu
   ══════════════════════════════════════════════════════════════ */

/**
 * Combien de courriels sont déjà partis vers ce lieu ces sept derniers jours :
 * une demande passée en 'invite' ou en 'accepte' en a déclenché un.
 */
export async function invitationsRecentes(
  admin: ServiceClient,
  organizationId: string
): Promise<number> {
  const depuis = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { count } = await admin
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["invite", "accepte"])
    .gte("created_at", depuis);
  return count ?? 0;
}

/** Toutes les demandes déposées pour ce lieu depuis 24 h, confirmées ou non. */
export async function demandesDuJour(
  admin: ServiceClient,
  organizationId: string
): Promise<number> {
  const depuis = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", depuis);
  return count ?? 0;
}

/* ══════════════════════════════════════════════════════════════
   Garde-fou n°1 — la part persistante de la limite par IP
   ══════════════════════════════════════════════════════════════ */

/**
 * Le compteur en mémoire attrape la rafale mais repart à zéro au redémarrage
 * du process ; celui-ci tient sur 24 h et survit à un déploiement.
 */
export async function depotsDepuisIp(admin: ServiceClient, ip: string): Promise<number> {
  const depuis = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("request_ip", ip)
    .gte("created_at", depuis);
  return count ?? 0;
}

/* ══════════════════════════════════════════════════════════════
   Voie automatique — l'invitation part à l'adresse du lieu
   ══════════════════════════════════════════════════════════════ */

/**
 * Crée l'invitation et l'envoie à l'adresse publiée par le lieu.
 * Renvoie `false` si le courriel n'est pas parti : l'appelant bascule alors en
 * arbitrage, plutôt que d'annoncer un envoi qui n'a pas eu lieu.
 */
export async function inviterLeLieu(args: {
  admin: ServiceClient;
  claimId: string;
  org: { id: string; slug: string; name: string };
  adresseLieu: string;
  demandeurNom: string;
  demandeurFonction: string | null;
  eventId: string | null;
}): Promise<boolean> {
  const { admin, claimId, org, adresseLieu } = args;

  const expires = new Date(Date.now() + VALIDITE_JOURS * 24 * 60 * 60 * 1000);

  // Rôle `admin` : la voie automatique EST la vérification, il n'y a pas de
  // second contrôle à attendre. Un lieu qui reprend sa page doit pouvoir
  // inviter son équipe le jour même.
  const { data: invitation, error: invErr } = await admin
    .from("invitations")
    .insert({
      organization_id: org.id,
      email: adresseLieu,
      role: "admin",
      expires_at: expires.toISOString(),
    })
    .select("id, token")
    .maybeSingle();

  if (invErr || !invitation) {
    console.error("inviterLeLieu: invitation non créée", invErr);
    return false;
  }

  const inviteUrl = `${appUrl()}/rejoindre/${invitation.token}`;
  const ficheUrl = args.eventId
    ? `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/evenement/${args.eventId}`
    : null;

  const { count } = await admin
    .from("evenements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .gte("start_at", new Date().toISOString());

  let envoye = false;
  try {
    const { sendMail } = await import("@/lib/mail");
    const { tplRevendicationInvitation } = await import("@/lib/mail-templates");
    envoye = await sendMail({
      to: adresseLieu,
      subject: `Reprenez la page de ${org.name} sur Casaminga`,
      html: tplRevendicationInvitation({
        orgName: org.name,
        demandeurNom: args.demandeurNom,
        demandeurFonction: args.demandeurFonction,
        inviteUrl,
        ficheUrl,
        nbEvenements: count ?? 0,
        expiresLabel: expires.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      }),
      category: "revendication",
      organizationId: org.id,
    });
  } catch (e) {
    console.error("inviterLeLieu: envoi impossible", e);
  }

  if (!envoye) {
    // L'invitation existe mais personne ne l'a reçue : elle serait un jeton
    // valable dans la nature, sans destinataire. On la retire.
    await admin.from("invitations").delete().eq("id", invitation.id);
    return false;
  }

  await admin
    .from("claims")
    .update({ status: "invite", invitation_id: invitation.id })
    .eq("id", claimId);
  return true;
}

/* ══════════════════════════════════════════════════════════════
   Voie manuelle — la demande attend un arbitrage
   ══════════════════════════════════════════════════════════════ */

export async function alerterArbitrage(args: {
  org: { name: string; slug: string; website: string | null };
  fullName: string;
  roleLabel: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  eventTitre: string | null;
}): Promise<void> {
  try {
    const { sendMail, adminEmail } = await import("@/lib/mail");
    const { tplRevendicationArbitrage } = await import("@/lib/mail-templates");
    const destinataire = adminEmail();
    if (!destinataire) return;
    await sendMail({
      to: destinataire,
      subject: `Revendication à arbitrer : ${args.org.name}`,
      html: tplRevendicationArbitrage({
        orgName: args.org.name,
        orgSlug: args.org.slug,
        demandeurNom: args.fullName,
        demandeurFonction: args.roleLabel,
        demandeurEmail: args.email,
        demandeurTel: args.phone,
        message: args.message,
        siteWeb: args.org.website,
        evenementTitre: args.eventTitre,
        arbitrageUrl: `${appUrl()}/admin/revendications`,
      }),
      category: "revendication",
      // Pas d'organizationId : l'alerte va à Léo, pas au lieu. La passer
      // ferait taire le message pour une organisation de démonstration.
    });
  } catch (e) {
    console.error("alerterArbitrage: alerte non envoyée", e);
  }
}

/* ══════════════════════════════════════════════════════════════
   Garde-fou n°3 — la confirmation du demandeur
   ══════════════════════════════════════════════════════════════ */

export type ConfirmEtat = "ok" | "deja" | "inconnu" | "expire" | "indisponible" | "erreur";

export interface ConfirmResult {
  etat: ConfirmEtat;
  orgName?: string;
  voie?: Voie;
  adresseIndice?: string | null;
  /** Renseigné quand la limite du lieu a retenu l'envoi : le demandeur doit
   *  comprendre que ce n'est pas une panne. */
  saturation?: boolean;
}

/**
 * Le clic sur le lien reçu par le demandeur. C'est le seul chemin par lequel
 * un courriel peut désormais atteindre un lieu.
 *
 * Idempotent : la bascule d'état est conditionnée à `status = 'non_confirme'`
 * et vérifiée par la ligne renvoyée. Deux clics — l'aperçu du lien par un
 * client de messagerie, puis le vrai — n'envoient pas deux invitations.
 */
export async function confirmerRevendication(token: string): Promise<ConfirmResult> {
  const admin = adminClaims();
  if (!admin) return { etat: "erreur" };

  const { data: claim } = await admin
    .from("claims")
    .select(
      "id, organization_id, event_id, full_name, role_label, email, phone, message, status, verification, confirm_sent_at, confirmed_at"
    )
    .eq("confirm_token", token)
    .maybeSingle();

  if (!claim) return { etat: "inconnu" };

  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, email, website, source, claimed_at")
    .eq("id", claim.organization_id)
    .maybeSingle();

  if (!org) return { etat: "erreur" };

  if (claim.confirmed_at || claim.status !== "non_confirme") {
    return { etat: "deja", orgName: org.name, voie: claim.verification as Voie };
  }

  const emis = claim.confirm_sent_at ? new Date(claim.confirm_sent_at).getTime() : 0;
  if (!emis || Date.now() - emis > CONFIRMATION_HEURES * 3600_000) {
    return { etat: "expire", orgName: org.name };
  }

  // Le lieu a pu reprendre sa page entre le dépôt et le clic.
  if (org.source === "casaminga" || org.claimed_at) {
    return { etat: "indisponible", orgName: org.name };
  }

  const adresseLieu = (org.email ?? "").trim();
  const voieInitiale: Voie = EMAIL_RE.test(adresseLieu) ? "auto" : "manuel";

  // Garde-fou n°2, à l'instant qui compte. Le dépôt l'a déjà vérifié, mais
  // rien n'empêche des demandes déposées hier d'être toutes confirmées
  // aujourd'hui : c'est ici, et seulement ici, que le courriel part vraiment.
  // Au-delà du seuil, la demande n'est pas perdue — elle part en arbitrage.
  const saturation =
    voieInitiale === "auto" &&
    (await invitationsRecentes(admin, org.id)) >= LIEU_INVITATIONS_7J;

  // Bascule d'état AVANT tout envoi : c'est elle qui rend l'opération unique.
  const { data: verrou } = await admin
    .from("claims")
    .update({
      confirmed_at: new Date().toISOString(),
      status: "en_attente",
      ...(saturation ? { verification: "manuel" } : {}),
    })
    .eq("id", claim.id)
    .eq("status", "non_confirme")
    .select("id");

  if (!verrou || verrou.length === 0) {
    return { etat: "deja", orgName: org.name, voie: claim.verification as Voie };
  }

  let eventTitre: string | null = null;
  if (claim.event_id) {
    const { data: ev } = await admin
      .from("evenements")
      .select("title")
      .eq("id", claim.event_id)
      .maybeSingle();
    eventTitre = ev?.title ?? null;
  }

  let voie: Voie = saturation ? "manuel" : voieInitiale;
  if (voie === "auto") {
    const envoye = await inviterLeLieu({
      admin,
      claimId: claim.id,
      org: { id: org.id, slug: org.slug, name: org.name },
      adresseLieu,
      demandeurNom: claim.full_name,
      demandeurFonction: claim.role_label,
      eventId: claim.event_id,
    });
    // Le courriel n'est pas parti (SMTP muet, adresse refusée) : la demande
    // ne peut pas être annoncée comme vérifiée. Elle bascule en arbitrage
    // plutôt que de laisser croire à un envoi.
    if (!envoye) {
      voie = "manuel";
      await admin.from("claims").update({ verification: "manuel" }).eq("id", claim.id);
    }
  }

  if (voie === "manuel") {
    await alerterArbitrage({
      org: { name: org.name, slug: org.slug, website: org.website },
      fullName: claim.full_name,
      roleLabel: claim.role_label,
      email: claim.email,
      phone: claim.phone,
      message: claim.message,
      eventTitre,
    });
  }

  return {
    etat: "ok",
    orgName: org.name,
    voie,
    saturation,
    adresseIndice: voie === "auto" ? indiceAdresse(adresseLieu) : null,
  };
}
