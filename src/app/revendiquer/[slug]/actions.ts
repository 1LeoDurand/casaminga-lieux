"use server";

import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  EMAIL_RE,
  EMAIL_PAR_HEURE,
  IP_PAR_HEURE,
  IP_PAR_JOUR,
  LIEU_PAR_JOUR,
  LIEU_INVITATIONS_7J,
  CONFIRMATION_HEURES,
  adminClaims,
  confirmationUrl,
  demandesDuJour,
  depotsDepuisIp,
  invitationsRecentes,
  nouveauJeton,
  type ServiceClient,
  type Voie,
} from "@/lib/claims/revendication";

/**
 * Dépôt d'une demande de revendication.
 *
 * L'agenda de casaminga.com reprend des événements publiés dans les agendas
 * ouverts du territoire. 118 des 132 organisations en base sont arrivées par
 * là : personne chez elles n'a de compte, et souvent personne ne sait que
 * Casaminga existe. La revendication est le geste par lequel un de ces lieux
 * reprend la main.
 *
 * Elle ne crée PAS d'organisation. Elle émet une invitation contre celle qui
 * existe déjà, avec ses événements et son établissement, et confie la suite à
 * /rejoindre/[token], inchangé. `signup/actions.ts` fait l'inverse et n'a rien
 * à faire ici.
 *
 * CE QUE CETTE ACTION N'ENVOIE PLUS : rien ne part vers le lieu ici. La page
 * est publique, sans compte ni captcha ; dans sa première forme, une requête
 * POST suffisait à déclencher un courriel, et 118 requêtes à en déclencher
 * 118 — depuis casaminga.com, vers des lieux qui n'avaient rien demandé, au
 * risque de faire classer le domaine comme spammeur. Trois garde-fous
 * encadrent maintenant le dépôt :
 *
 *   1. une limite par IP  — cinq dépôts par heure (mémoire), vingt par jour
 *                            (comptés en base, pour survivre à un
 *                            redémarrage) ;
 *   2. une limite par lieu — trois demandes par jour, et surtout deux
 *                            courriels vers un même lieu par semaine, vérifiés
 *                            à l'instant de l'envoi ;
 *   3. la vérification du demandeur — un lien de confirmation part à SON
 *                            adresse, et le lieu n'est prévenu que s'il le
 *                            suit. Un script qui ne relève pas la boîte qu'il
 *                            déclare ne déclenche plus rien du tout.
 *
 * La suite du parcours vit dans `lib/claims/revendication.ts`, appelée par
 * /revendiquer/confirmer/[token].
 */

export type { Voie };

export interface ClaimResult {
  ok: boolean;
  /** Vrai quand la demande existait déjà et que le lien a simplement été
   *  renvoyé : le message affiché n'est pas tout à fait le même. */
  renvoi?: boolean;
  error?: string;
}

export interface ClaimInput {
  slug: string;
  eventId: string | null;
  fullName: string;
  roleLabel: string;
  email: string;
  phone: string;
  message: string;
}

/** L'IP du visiteur derrière le proxy Infomaniak. `unknown` quand aucun
 *  en-tête ne la porte : la limite s'applique alors à ce seau commun, ce qui
 *  est le comportement prudent. */
async function ipDuVisiteur(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "inconnue"
  );
}

/** Envoie (ou renvoie) le lien de confirmation au demandeur. */
async function envoyerConfirmation(args: {
  email: string;
  orgName: string;
  token: string;
}): Promise<boolean> {
  try {
    const { sendMail } = await import("@/lib/mail");
    const { tplRevendicationConfirmation } = await import("@/lib/mail-templates");
    return await sendMail({
      to: args.email,
      subject: `Confirmez votre demande pour ${args.orgName}`,
      html: tplRevendicationConfirmation({
        orgName: args.orgName,
        confirmUrl: confirmationUrl(args.token),
        heures: CONFIRMATION_HEURES,
      }),
      category: "revendication",
      // Pas d'organizationId : ce message part au demandeur, pas au lieu, et
      // à ce stade rien ne dit encore qu'il en fait partie.
    });
  } catch (e) {
    console.error("envoyerConfirmation: envoi impossible", e);
    return false;
  }
}

const TROP_DE_DEMANDES =
  "Trop de demandes ont été envoyées depuis cet appareil. Réessayez dans une heure, ou écrivez-nous à contact@casaminga.com.";

/**
 * Le lien de confirmation est déjà parti pour cette demande : on le renvoie
 * plutôt que d'échouer sur l'index d'unicité. C'est le cas d'un
 * rafraîchissement de page, et celui d'un courriel qui s'est perdu.
 */
async function renvoyerLien(
  admin: ServiceClient,
  orgId: string,
  orgName: string,
  email: string
): Promise<ClaimResult> {
  const { data: existante } = await admin
    .from("claims")
    .select("id, status")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .in("status", ["non_confirme", "en_attente", "invite"])
    .maybeSingle();

  if (existante?.status !== "non_confirme") {
    return {
      ok: false,
      error:
        "Une demande est déjà en cours pour ce lieu avec cette adresse. Nous revenons vers vous, inutile de la renvoyer.",
    };
  }

  // Le compteur par adresse a déjà été prélevé par l'appelant : réactualiser
  // la page dix fois renvoie au plus trois courriels, pas dix.
  const token = nouveauJeton();
  await admin
    .from("claims")
    .update({ confirm_token: token, confirm_sent_at: new Date().toISOString() })
    .eq("id", existante.id);

  await envoyerConfirmation({ email, orgName, token });
  return { ok: true, renvoi: true };
}

export async function submitClaim(input: ClaimInput): Promise<ClaimResult> {
  const admin = adminClaims();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const roleLabel = input.roleLabel.trim();
  const phone = input.phone.trim();
  const message = input.message.trim();

  if (fullName.length < 2) return { ok: false, error: "Merci d'indiquer votre nom." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Cette adresse ne semble pas valide." };

  // ── Garde-fou n°1 : la rafale, avant toute requête en base ───
  const ip = await ipDuVisiteur();
  if (!rateLimit(`claim-ip:${ip}`, IP_PAR_HEURE, 3_600_000)) {
    return { ok: false, error: TROP_DE_DEMANDES };
  }
  if (!rateLimit(`claim-mail:${email}`, EMAIL_PAR_HEURE, 3_600_000)) {
    return { ok: false, error: TROP_DE_DEMANDES };
  }

  // ── 1. Le lieu, et son droit à être revendiqué ───────────────
  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, email, source, claimed_at")
    .eq("slug", input.slug)
    .maybeSingle();

  if (!org) return { ok: false, error: "Ce lieu n'existe pas sur Casaminga." };
  if (org.source === "casaminga") {
    return {
      ok: false,
      error:
        "Ce lieu gère déjà sa page depuis Casa Minga. Si vous en faites partie, demandez à son équipe de vous inviter.",
    };
  }
  if (org.claimed_at) {
    return {
      ok: false,
      error:
        "Cette page a déjà été reprise par son équipe. Si vous en faites partie, demandez-leur de vous inviter.",
    };
  }

  // ── Garde-fou n°1, suite : la part qui survit au redémarrage ─
  if (ip !== "inconnue" && (await depotsDepuisIp(admin, ip)) >= IP_PAR_JOUR) {
    return { ok: false, error: TROP_DE_DEMANDES };
  }

  // ── Garde-fou n°2 : la limite par lieu ───────────────────────
  // Deux seuils : le nombre de demandes déposées, qui protège la table, et le
  // nombre de courriels déjà partis là-bas, qui protège le lieu. Le second
  // est revérifié au moment de l'envoi — c'est là qu'il est décisif.
  if ((await demandesDuJour(admin, org.id)) >= LIEU_PAR_JOUR) {
    return {
      ok: false,
      error:
        "Plusieurs demandes ont déjà été déposées pour ce lieu aujourd'hui. Écrivez-nous à contact@casaminga.com, nous les regardons ensemble.",
    };
  }
  const adresseLieu = (org.email ?? "").trim();
  const voieInitiale: Voie = EMAIL_RE.test(adresseLieu) ? "auto" : "manuel";
  if (
    voieInitiale === "auto" &&
    (await invitationsRecentes(admin, org.id)) >= LIEU_INVITATIONS_7J
  ) {
    // Le lieu a déjà reçu deux courriels cette semaine. Refuser franchement
    // vaut mieux que d'accepter une demande qui finira en arbitrage sans que
    // le demandeur comprenne pourquoi.
    return {
      ok: false,
      error:
        "Ce lieu a déjà été sollicité récemment ; nous ne lui écrirons pas une troisième fois cette semaine. Écrivez-nous à contact@casaminga.com.",
    };
  }

  // ── 2. L'événement d'où part la demande ──────────────────────
  // Vérifié : un identifiant glissé dans l'URL ne doit pas rattacher la
  // demande à l'événement d'un autre lieu.
  let eventId: string | null = null;
  if (input.eventId) {
    const { data: ev } = await admin
      .from("evenements")
      .select("id")
      .eq("id", input.eventId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (ev) eventId = ev.id;
  }

  // ── 3. La demande, non confirmée ─────────────────────────────
  // `verification` dit la voie que la demande SUIVRA une fois confirmée. Elle
  // est recalculée au moment du clic : le lieu a pu publier une adresse ou
  // reprendre sa page entre-temps.
  const token = nouveauJeton();
  const { data: claim, error: claimErr } = await admin
    .from("claims")
    .insert({
      organization_id: org.id,
      event_id: eventId,
      full_name: fullName,
      role_label: roleLabel || null,
      email,
      phone: phone || null,
      message: message || null,
      status: "non_confirme",
      verification: voieInitiale,
      confirm_token: token,
      confirm_sent_at: new Date().toISOString(),
      request_ip: ip === "inconnue" ? null : ip,
    })
    .select("id")
    .maybeSingle();

  if (claimErr) {
    // 23505 : l'index partiel `claims_vivante_unique`. Une demande de cette
    // personne pour ce lieu est déjà vivante — un rafraîchissement de page,
    // le plus souvent. Ce n'est pas une erreur à afficher comme telle.
    if (claimErr.code === "23505") {
      return renvoyerLien(admin, org.id, org.name, email);
    }
    return { ok: false, error: "La demande n'a pas pu être enregistrée." };
  }

  // ── 4. Garde-fou n°3 : le lien de confirmation ───────────────
  const envoye = await envoyerConfirmation({ email, orgName: org.name, token });
  if (!envoye) {
    // Sans ce courriel, la demande est un cul-de-sac : elle occuperait l'index
    // d'unicité sans pouvoir être confirmée ni renvoyée utilement. On la
    // retire pour que le demandeur puisse réessayer.
    if (claim?.id) await admin.from("claims").delete().eq("id", claim.id);
    return {
      ok: false,
      error:
        "Nous n'arrivons pas à vous envoyer le courriel de confirmation. Réessayez dans un moment, ou écrivez-nous à contact@casaminga.com.",
    };
  }

  return { ok: true };
}
