/**
 * Envoi d'une campagne, avec reprise.
 *
 * Le problème que ce module règle : l'envoi est une boucle synchrone dans une
 * requête HTTP. Si elle est interrompue (délai d'exécution dépassé, redémarrage
 * du serveur), la campagne reste dans son état de départ et le passage suivant
 * la renvoie **depuis le premier destinataire**. Les premiers inscrits
 * reçoivent alors la même newsletter deux fois — c'est le genre d'incident qui
 * fait cliquer « spam » plutôt que « se désabonner ».
 *
 * Trois protections, du plus large au plus fin :
 *   1. la réservation (`claimCampaign`) : un seul passage peut démarrer un envoi ;
 *   2. le registre `newsletter_deliveries` : la reprise saute ce qui est déjà parti ;
 *   3. la contrainte unique (campaign_id, email) : le filet, en base.
 */

import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mail";

/** Au-delà, un envoi « en_cours » est considéré comme interrompu et repris. */
export const STALE_SEND_MINUTES = 15;

export interface DeliveryRecipient {
  name: string;
  email: string;
  unsubscribe_token: string;
}

function ledgerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

/**
 * Réserve la campagne : passe le statut à `en_cours`, mais seulement si
 * personne ne l'a déjà fait. La condition est évaluée par la base, donc deux
 * passages simultanés ne peuvent pas tous deux réussir.
 *
 * Renvoie `false` si l'envoi est déjà pris en charge — l'appelant doit alors
 * s'abstenir, pas réessayer.
 */
export async function claimCampaign(
  campaignId: string,
  opts: { resumeStale?: boolean } = {}
): Promise<boolean> {
  const admin = ledgerClient();
  if (!admin) return false;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_SEND_MINUTES * 60_000).toISOString();

  // Cas normal : la campagne n'est pas encore en cours d'envoi.
  const { data } = await admin
    .from("newsletter_campaigns")
    .update({ statut: "en_cours", envoi_demarre_le: now.toISOString() })
    .eq("id", campaignId)
    .neq("statut", "en_cours")
    .neq("statut", "envoyee")
    .select("id");
  if (data && data.length > 0) return true;

  if (!opts.resumeStale) return false;

  // Reprise : l'envoi est marqué en cours depuis trop longtemps pour qu'il le
  // soit encore vraiment. On le récupère en réarmant l'horodatage.
  const { data: resumed } = await admin
    .from("newsletter_campaigns")
    .update({ envoi_demarre_le: now.toISOString() })
    .eq("id", campaignId)
    .eq("statut", "en_cours")
    .lt("envoi_demarre_le", staleBefore)
    .select("id");
  return !!resumed && resumed.length > 0;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Envoie la campagne aux destinataires qui ne l'ont pas encore reçue.
 *
 * `renderHtml` est appelé par destinataire : le lien de désabonnement est
 * propre à chacun, un HTML partagé le rendrait faux pour tout le monde sauf un.
 */
export async function sendCampaignBatch(params: {
  campaignId: string;
  organizationId: string;
  sujet: string;
  recipients: DeliveryRecipient[];
  renderHtml: (recipient: DeliveryRecipient) => string;
  baseUrl: string;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const { campaignId, organizationId, sujet, recipients, renderHtml, baseUrl } = params;
  const admin = ledgerClient();

  // Deux fiches peuvent porter la même adresse (doublon, couple, contact
  // partagé). Une adresse = un envoi.
  const unique = new Map<string, DeliveryRecipient>();
  for (const r of recipients) {
    if (!r.email) continue;
    const key = normalizeEmail(r.email);
    if (!unique.has(key)) unique.set(key, r);
  }

  // Ce qui est déjà parti lors d'une tentative précédente.
  const already = new Set<string>();
  if (admin) {
    const { data } = await admin
      .from("newsletter_deliveries")
      .select("email")
      .eq("campaign_id", campaignId);
    for (const row of data ?? []) already.add(normalizeEmail((row as { email: string }).email));
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [key, recipient] of unique) {
    if (already.has(key)) {
      skipped++;
      continue;
    }

    // Le registre est écrit AVANT l'envoi : si le processus meurt entre les
    // deux, on préfère un destinataire oublié à un destinataire servi deux
    // fois. Un conflit ici signifie qu'un autre passage l'a déjà pris.
    if (admin) {
      const { error } = await admin
        .from("newsletter_deliveries")
        .insert({ campaign_id: campaignId, email: key, statut: "en_cours" });
      if (error) {
        skipped++;
        continue;
      }
    }

    const ok = await sendMail({
      to: recipient.email,
      subject: sujet,
      html: renderHtml(recipient),
      category: "newsletter",
      organizationId,
      unsubscribeUrl: `${baseUrl}/api/unsubscribe/${recipient.unsubscribe_token}`,
    });

    if (ok) sent++;
    else failed++;

    if (admin) {
      await admin
        .from("newsletter_deliveries")
        .update({ statut: ok ? "envoye" : "echec", sent_at: new Date().toISOString() })
        .eq("campaign_id", campaignId)
        .eq("email", key);
    }

    await new Promise((r) => setTimeout(r, 50)); // throttle SMTP
  }

  return { sent, failed, skipped };
}

/** Clôt la campagne. Les compteurs cumulent les tentatives précédentes. */
export async function finalizeCampaign(
  campaignId: string,
  counts: { sent: number; failed: number },
  extra: { html_archive?: string } = {}
): Promise<void> {
  const admin = ledgerClient();
  if (!admin) return;
  const { count: totalSent } = await admin
    .from("newsletter_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("statut", "envoye");
  const { count: totalFailed } = await admin
    .from("newsletter_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("statut", "echec");
  await admin
    .from("newsletter_campaigns")
    .update({
      statut: "envoyee",
      envoyee_le: new Date().toISOString(),
      nb_envoyes: totalSent ?? counts.sent,
      nb_echecs: totalFailed ?? counts.failed,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", campaignId);
}
