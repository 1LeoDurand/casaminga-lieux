"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrganizationBySlug } from "@/lib/data";
import {
  getNewsletterCampaign,
  getNewsletterRecipients,
  upsertNewsletterSettings,
  updateNewsletterCampaign,
  createNewsletterCampaign,
  deleteNewsletterCampaign,
} from "@/lib/newsletter/data";
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
): Promise<{ ok: boolean; sent?: number; total?: number; error?: string }> {
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

  const resolved = await resolveAllBlocks(orgId);
  const { sendMail } = await import("@/lib/mail");

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const unsubUrl = `${BASE_URL}/unsubscribe/${recipient.unsubscribe_token}`;
    const html = renderNewsletterHtml(campaign.blocs, {
      orgName: org.name,
      orgSlug: org.slug,
      accentColor: org.primary_color,
      siteBase: BASE_URL,
      unsubscribeUrl: unsubUrl,
      ...resolved,
    });
    const ok = await sendMail({
      to: recipient.email,
      subject: campaign.sujet,
      html,
      category: "newsletter",
      organizationId: orgId,
    });
    if (ok) sent++; else failed++;
    await new Promise((r) => setTimeout(r, 50)); // throttle SMTP
  }

  // Archiver le rendu + marquer envoyée
  const sampleHtml = renderNewsletterHtml(campaign.blocs, {
    orgName: org.name,
    orgSlug: org.slug,
    accentColor: org.primary_color,
    siteBase: BASE_URL,
    unsubscribeUrl: `${BASE_URL}/unsubscribe/preview`,
    ...resolved,
  });

  await updateNewsletterCampaign(campaignId, { statut: "envoyee" });
  const supabase = await createClient();
  await supabase.from("newsletter_campaigns").update({
    envoyee_le: new Date().toISOString(),
    nb_envoyes: sent,
    nb_echecs: failed,
    html_archive: sampleHtml,
  }).eq("id", campaignId);

  revalidatePath(`/dashboard/${orgSlug}/communication`);
  return { ok: true, sent, total: recipients.length };
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
