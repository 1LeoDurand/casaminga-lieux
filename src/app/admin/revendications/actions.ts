"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";

/**
 * Arbitrage des revendications que la voie automatique ne peut pas trancher.
 *
 * Elle ne le peut pas dans 103 cas sur 118 : le lieu n'a publié aucune adresse
 * de contact, il n'existe donc aucune boîte dont on puisse dire « qui la relève
 * est du lieu ». Quelqu'un doit regarder.
 *
 * Accepter, ici, c'est envoyer l'invitation à l'adresse que le demandeur a
 * saisie — celle-là même dont on ne pouvait rien conclure. C'est le geste par
 * lequel Léo se porte garant, et c'est pour cela qu'il est manuel.
 */

const VALIDITE_JOURS = 30;

type Res = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/admin/revendications");
  revalidatePath("/admin");
}

/**
 * Accepte une demande : l'invitation part à l'adresse du demandeur, en rôle
 * `admin`. Le lieu n'est PAS marqué comme revendiqué ici — il le sera quand
 * l'invitation sera consommée, dans /rejoindre/[token]. Tant que personne n'a
 * créé de compte, rien n'a changé pour de bon.
 */
export async function approveClaim(claimId: string): Promise<Res> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };

  const { data: claim } = await admin
    .from("claims")
    .select("id, organization_id, email, full_name, status")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { ok: false, error: "Demande introuvable." };
  if (claim.status !== "en_attente") {
    return { ok: false, error: "Cette demande a déjà été traitée." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, claimed_at")
    .eq("id", claim.organization_id)
    .maybeSingle();
  if (!org) return { ok: false, error: "Lieu introuvable." };
  if (org.claimed_at) {
    return { ok: false, error: "Ce lieu a déjà été repris entre-temps." };
  }

  const expires = new Date(Date.now() + VALIDITE_JOURS * 24 * 60 * 60 * 1000);
  const { data: invitation, error: invErr } = await admin
    .from("invitations")
    .insert({
      organization_id: org.id,
      email: claim.email,
      role: "admin",
      expires_at: expires.toISOString(),
    })
    .select("id, token")
    .maybeSingle();
  if (invErr || !invitation) {
    return { ok: false, error: "L'invitation n'a pas pu être créée." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
  let envoye = false;
  try {
    const { sendMail } = await import("@/lib/mail");
    const { tplRevendicationInvitation } = await import("@/lib/mail-templates");
    const now = new Date().toISOString();
    const { count } = await admin
      .from("evenements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .gte("start_at", now);
    envoye = await sendMail({
      to: claim.email,
      subject: `Reprenez la page de ${org.name} sur Casaminga`,
      html: tplRevendicationInvitation({
        orgName: org.name,
        demandeurNom: claim.full_name,
        demandeurFonction: null,
        inviteUrl: `${appUrl}/rejoindre/${invitation.token}`,
        ficheUrl: null,
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
    console.error("approveClaim: envoi impossible", e);
  }

  if (!envoye) {
    // Un jeton valable que personne n'a reçu ne doit pas rester en base.
    await admin.from("invitations").delete().eq("id", invitation.id);
    return { ok: false, error: "Le courriel n'est pas parti. La demande reste en attente." };
  }

  await admin
    .from("claims")
    .update({
      status: "invite",
      invitation_id: invitation.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  refresh();
  return { ok: true };
}

/**
 * Refuse une demande. Aucun courriel automatique : un refus se dit avec des
 * mots choisis, et souvent au téléphone. Le motif sert à s'en souvenir, pas à
 * être envoyé.
 */
export async function refuseClaim(claimId: string, reason: string): Promise<Res> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };

  const { error } = await admin
    .from("claims")
    .update({
      status: "refuse",
      refusal_reason: reason.trim() || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("status", "en_attente");
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}
