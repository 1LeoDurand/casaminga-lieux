"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

/**
 * Revendication d'une fiche moissonnée.
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
 * Cette action tourne en clé de service parce qu'elle s'exécute pour un
 * visiteur anonyme : `claims` est fermée à `anon` comme à `authenticated`, et
 * `invitations` ne s'écrit pas depuis un navigateur. Elle ne renvoie jamais au
 * client autre chose qu'un état et un message.
 */

/** Un mois, et non les sept jours d'une invitation d'équipe. Le courriel
 *  générique d'une médiathèque ou d'une mairie est relevé une fois par
 *  semaine ; sept jours condamnaient la moitié des invitations. */
const VALIDITE_JOURS = 30;

export type Voie = "auto" | "manuel";

export interface ClaimResult {
  ok: boolean;
  /** Renseignée si ok : dit au demandeur où le lien est parti. */
  voie?: Voie;
  /** Indice d'adresse (« c…t@ville.fr ») en voie automatique, jamais l'adresse
   *  entière : la page est publique, elle ne doit pas divulguer un contact. */
  adresseIndice?: string | null;
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

/** Masque une adresse : « contact@ville.fr » → « c…t@ville.fr ». */
function indiceAdresse(email: string): string {
  const [local, domaine] = email.split("@");
  if (!domaine) return "…";
  const masque =
    local.length <= 2 ? `${local[0]}…` : `${local[0]}…${local[local.length - 1]}`;
  return `${masque}@${domaine}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Fabrique du client de service, factorisée pour une raison de typage : passer
 * le client à une fonction annotée `ReturnType<typeof createServiceClient>`
 * fait retomber ses paramètres génériques sur `never`, et toute requête
 * devient inutilisable. Le type dérivé de cette fabrique est concret.
 */
function serviceClient(url: string, key: string) {
  return createServiceClient(url, key, { auth: { persistSession: false } });
}
type ServiceClient = ReturnType<typeof serviceClient>;

export async function submitClaim(input: ClaimInput): Promise<ClaimResult> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    return { ok: false, error: "Configuration serveur manquante." };
  }

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const roleLabel = input.roleLabel.trim();
  const phone = input.phone.trim();
  const message = input.message.trim();

  if (fullName.length < 2) return { ok: false, error: "Merci d'indiquer votre nom." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Cette adresse ne semble pas valide." };

  const admin = serviceClient(SUPABASE_URL, serviceRoleKey);

  // ── 1. Le lieu, et son droit à être revendiqué ───────────────
  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, email, website, source, claimed_at")
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

  // ── 2. L'événement d'où part la demande ──────────────────────
  // Vérifié : un identifiant glissé dans l'URL ne doit pas rattacher la
  // demande à l'événement d'un autre lieu.
  let eventId: string | null = null;
  let eventTitre: string | null = null;
  if (input.eventId) {
    const { data: ev } = await admin
      .from("evenements")
      .select("id, title")
      .eq("id", input.eventId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (ev) {
      eventId = ev.id;
      eventTitre = ev.title;
    }
  }

  // ── 3. La voie de vérification ───────────────────────────────
  // Le lieu a-t-il publié une adresse de contact ? Si oui, le lien part
  // là-bas et nulle part ailleurs : quiconque relève ce courrier est
  // légitime, et le demandeur n'a pas à être cru sur parole.
  const adresseLieu = (org.email ?? "").trim();
  const voieInitiale: Voie = EMAIL_RE.test(adresseLieu) ? "auto" : "manuel";

  // ── 4. La demande ────────────────────────────────────────────
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
      status: "en_attente",
      verification: voieInitiale,
    })
    .select("id")
    .maybeSingle();

  if (claimErr) {
    // 23505 : l'index partiel `claims_vivante_unique`. Une demande de cette
    // personne pour ce lieu est déjà en cours — un rafraîchissement de page,
    // le plus souvent. Ce n'est pas une erreur à afficher comme telle.
    if (claimErr.code === "23505") {
      return {
        ok: false,
        error:
          "Une demande est déjà en cours pour ce lieu avec cette adresse. Nous revenons vers vous, inutile de la renvoyer.",
      };
    }
    return { ok: false, error: "La demande n'a pas pu être enregistrée." };
  }
  const claimId = claim?.id as string | undefined;

  // ── 5. Voie automatique : l'invitation part à l'adresse du lieu ──
  let voie: Voie = voieInitiale;
  if (voieInitiale === "auto" && claimId) {
    const envoye = await inviterLeLieu({
      admin,
      claimId,
      org: { id: org.id, slug: org.slug, name: org.name },
      adresseLieu,
      demandeurNom: fullName,
      demandeurFonction: roleLabel || null,
      eventId,
    });
    // Le courriel n'est pas parti (SMTP muet, adresse refusée) : la demande
    // ne peut pas être annoncée comme vérifiée. Elle bascule en arbitrage
    // plutôt que de laisser croire à un envoi.
    if (!envoye) {
      voie = "manuel";
      await admin.from("claims").update({ verification: "manuel" }).eq("id", claimId);
    }
  }

  // ── 6. Voie manuelle : la demande attend un arbitrage ────────
  if (voie === "manuel") {
    await alerterArbitrage({
      org: { name: org.name, slug: org.slug, website: org.website },
      fullName,
      roleLabel: roleLabel || null,
      email,
      phone: phone || null,
      message: message || null,
      eventTitre,
    });
  }

  // ── 7. Accusé de réception au demandeur ──────────────────────
  // Il dit laquelle des deux voies a été suivie. Sans cette phrase, un
  // demandeur en voie automatique attend un courriel qui part chez son
  // employeur et conclut que le site est cassé.
  try {
    const { sendMail } = await import("@/lib/mail");
    const { tplRevendicationRecue } = await import("@/lib/mail-templates");
    await sendMail({
      to: email,
      subject: `Votre demande pour ${org.name} sur Casaminga`,
      html: tplRevendicationRecue({
        orgName: org.name,
        voie,
        adresseIndice: voie === "auto" ? indiceAdresse(adresseLieu) : null,
      }),
      category: "revendication",
      organizationId: org.id,
    });
  } catch (e) {
    console.error("submitClaim: accusé de réception non envoyé", e);
  }

  return {
    ok: true,
    voie,
    adresseIndice: voie === "auto" ? indiceAdresse(adresseLieu) : null,
  };
}

/* ══════════════════════════════════════════════════════════════
   Voie automatique
   ══════════════════════════════════════════════════════════════ */

/**
 * Crée l'invitation et l'envoie à l'adresse publiée par le lieu.
 * Renvoie `false` si le courriel n'est pas parti : l'appelant bascule alors en
 * arbitrage, plutôt que d'annoncer un envoi qui n'a pas eu lieu.
 */
async function inviterLeLieu(args: {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
  const inviteUrl = `${appUrl}/rejoindre/${invitation.token}`;
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
   Voie manuelle
   ══════════════════════════════════════════════════════════════ */

async function alerterArbitrage(args: {
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
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
        arbitrageUrl: `${appUrl}/admin/revendications`,
      }),
      category: "revendication",
      // Pas d'organizationId : l'alerte va à Léo, pas au lieu. La passer
      // ferait taire le message pour une organisation de démonstration.
    });
  } catch (e) {
    console.error("alerterArbitrage: alerte non envoyée", e);
  }
}
