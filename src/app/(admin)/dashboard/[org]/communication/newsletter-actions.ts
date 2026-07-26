"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrganizationBySlug } from "@/lib/data";
import {
  getNewsletterCampaign,
  getNewsletterRecipients,
  upsertNewsletterSettings,
  updateNewsletterCampaign,
  createNewsletterCampaign,
  deleteNewsletterCampaign,
  isTrackingEnabled,
} from "@/lib/newsletter/data";
import { claimCampaign, sendCampaignBatch, finalizeCampaign } from "@/lib/newsletter/send";
import { resolveAllBlocks } from "@/lib/newsletter/resolvers";
import { renderNewsletterHtml } from "@/lib/newsletter/renderer";
import type { NewsletterBlock, NewsletterSettings } from "@/lib/newsletter/types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

// ─── Créer campagne + rediriger vers l'éditeur ─────────────────────────────────

export async function newCampaignAction(orgId: string, orgSlug: string, templateBlocs: NewsletterBlock[] = []) {
  const result = await createNewsletterCampaign(orgId, "Sans titre", templateBlocs);
  if (!result) return; // silencieux, le redirect ne se fera pas
  redirect(`/dashboard/${orgSlug}/communication/${result.id}`);
}

// ─── Sauvegarder brouillon ─────────────────────────────────────────────────────

export async function saveDraftAction(
  campaignId: string,
  orgSlug: string,
  input: { sujet: string; blocs: NewsletterBlock[]; segment_id: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const res = await updateNewsletterCampaign(campaignId, {
    sujet: input.sujet,
    blocs: input.blocs,
    segment_id: input.segment_id,
    statut: "brouillon",
  });
  if (!res.ok) return res;
  revalidatePath(`/dashboard/${orgSlug}/communication`);
  return { ok: true };
}

// ─── Programmer ────────────────────────────────────────────────────────────────

export async function scheduleCampaignAction(
  campaignId: string,
  orgSlug: string,
  input: { sujet: string; blocs: NewsletterBlock[]; segment_id: string | null; programmee_pour: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!input.sujet.trim()) return { ok: false, error: "L'objet est requis." };
  if (!input.blocs.length) return { ok: false, error: "Ajoutez au moins un bloc." };
  const res = await updateNewsletterCampaign(campaignId, {
    sujet: input.sujet,
    blocs: input.blocs,
    segment_id: input.segment_id,
    statut: "programmee",
    programmee_pour: input.programmee_pour,
  });
  if (!res.ok) return res;
  revalidatePath(`/dashboard/${orgSlug}/communication`);
  return { ok: true };
}

// ─── Envoyer maintenant ────────────────────────────────────────────────────────

export async function sendCampaignNowAction(
  campaignId: string,
  orgId: string,
  orgSlug: string
): Promise<{ ok: boolean; sent?: number; skipped?: number; total?: number; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };

  const [campaign, org] = await Promise.all([
    getNewsletterCampaign(campaignId),
    getOrganizationBySlug(orgSlug),
  ]);
  if (!campaign || !org) return { ok: false, error: "Campagne introuvable." };
  if (!campaign.sujet.trim()) return { ok: false, error: "L'objet est requis." };
  if (!campaign.blocs.length) return { ok: false, error: "Ajoutez au moins un bloc." };

  const recipients = await getNewsletterRecipients(orgId, campaign.segment_id);
  if (!recipients.length) return { ok: false, error: "Aucun destinataire avec email." };

  // Réservation : deux clics sur « Envoyer », ou un clic pendant que le cron
  // traite la même campagne, ne doivent pas produire deux envois. La condition
  // est évaluée en base ; ici on se contente de renoncer.
  // `resumeStale` : si un envoi précédent s'est interrompu, on le reprend —
  // le registre fera sauter les destinataires déjà servis.
  const claimed = await claimCampaign(campaignId, { resumeStale: true });
  if (!claimed) {
    return { ok: false, error: "Un envoi de cette campagne est déjà en cours. Patientez quelques minutes." };
  }

  const [resolved, tracking] = await Promise.all([
    resolveAllBlocks(orgId),
    isTrackingEnabled(orgId),
  ]);

  const { sent, failed, skipped } = await sendCampaignBatch({
    campaignId,
    organizationId: orgId,
    sujet: campaign.sujet,
    recipients,
    baseUrl: BASE_URL,
    tracking,
    renderHtml: (recipient) =>
      renderNewsletterHtml(campaign.blocs, {
        orgName: org.name,
        orgSlug: org.slug,
        accentColor: org.primary_color,
        siteBase: BASE_URL,
        unsubscribeUrl: `${BASE_URL}/unsubscribe/${recipient.unsubscribe_token}`,
        ...resolved,
      }),
  });

  // Archiver le rendu + marquer envoyée
  const sampleHtml = renderNewsletterHtml(campaign.blocs, {
    orgName: org.name,
    orgSlug: org.slug,
    accentColor: org.primary_color,
    siteBase: BASE_URL,
    unsubscribeUrl: `${BASE_URL}/unsubscribe/preview`,
    ...resolved,
  });

  await finalizeCampaign(campaignId, { sent, failed }, { html_archive: sampleHtml });

  revalidatePath(`/dashboard/${orgSlug}/communication`);
  return { ok: true, sent, skipped, total: recipients.length };
}

// ─── Aperçu HTML ──────────────────────────────────────────────────────────────

export async function previewCampaignAction(
  orgId: string,
  orgSlug: string,
  blocs: NewsletterBlock[]
): Promise<{ ok: boolean; html?: string; error?: string }> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable." };
  const resolved = await resolveAllBlocks(orgId);
  const html = renderNewsletterHtml(blocs, {
    orgName: org.name,
    orgSlug: org.slug,
    accentColor: org.primary_color,
    siteBase: BASE_URL,
    unsubscribeUrl: `${BASE_URL}/unsubscribe/preview`,
    ...resolved,
  });
  return { ok: true, html };
}

// ─── Envoyer test ─────────────────────────────────────────────────────────────

export async function sendTestAction(
  orgId: string,
  orgSlug: string,
  blocs: NewsletterBlock[],
  sujet: string,
  toEmail: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return { ok: false, error: "Organisation introuvable." };
  const resolved = await resolveAllBlocks(orgId);
  const html = renderNewsletterHtml(blocs, {
    orgName: org.name,
    orgSlug: org.slug,
    accentColor: org.primary_color,
    siteBase: BASE_URL,
    unsubscribeUrl: `${BASE_URL}/unsubscribe/preview`,
    ...resolved,
  });
  const { sendMail } = await import("@/lib/mail");
  const ok = await sendMail({
    to: toEmail,
    subject: `[TEST] ${sujet || "Newsletter"}`,
    html,
    category: "newsletter",
    organizationId: orgId,
  });
  return ok ? { ok: true } : { ok: false, error: "Erreur SMTP." };
}

// ─── Supprimer brouillon ──────────────────────────────────────────────────────

export async function deleteCampaignAction(campaignId: string, orgSlug: string): Promise<{ ok: boolean }> {
  const res = await deleteNewsletterCampaign(campaignId);
  revalidatePath(`/dashboard/${orgSlug}/communication`);
  return res;
}

// ─── Réglages cadence ─────────────────────────────────────────────────────────

export async function saveSettingsAction(
  orgId: string,
  orgSlug: string,
  input: Partial<NewsletterSettings>
): Promise<{ ok: boolean; error?: string }> {
  const res = await upsertNewsletterSettings(orgId, input);
  if (res.ok) revalidatePath(`/dashboard/${orgSlug}/communication/settings`);
  return res;
}

// ─── Template par défaut ──────────────────────────────────────────────────────

export async function saveTemplateAction(
  orgId: string,
  orgSlug: string,
  blocs: NewsletterBlock[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await upsertNewsletterSettings(orgId, { blocs_template: blocs });
  if (res.ok) revalidatePath(`/dashboard/${orgSlug}/communication/settings`);
  return res;
}
