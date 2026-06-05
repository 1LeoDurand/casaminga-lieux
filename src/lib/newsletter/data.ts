/**
 * Fonctions de lecture/écriture pour le système newsletter.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { NewsletterSettings, NewsletterCampaign, NewsletterBlock } from "./types";

// ─── Settings ──────────────────────────────────────────────────────────────────

export async function getNewsletterSettings(orgId: string): Promise<NewsletterSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("newsletter_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data ?? null;
}

export async function upsertNewsletterSettings(
  orgId: string,
  input: Partial<Omit<NewsletterSettings, "id" | "organization_id" | "created_at" | "updated_at">>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_settings")
    .upsert({ organization_id: orgId, ...input, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Campagnes ─────────────────────────────────────────────────────────────────

export async function getNewsletterCampaigns(orgId: string): Promise<NewsletterCampaign[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("newsletter_campaigns")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as NewsletterCampaign[];
}

export async function getNewsletterCampaign(id: string): Promise<NewsletterCampaign | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as NewsletterCampaign | null;
}

export async function createNewsletterCampaign(
  orgId: string,
  sujet: string,
  blocs: NewsletterBlock[] = []
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .insert({ organization_id: orgId, sujet, blocs, statut: "brouillon" })
    .select("id")
    .single();
  if (error) return null;
  return { id: data.id };
}

export async function updateNewsletterCampaign(
  id: string,
  input: Partial<Pick<NewsletterCampaign, "sujet" | "blocs" | "statut" | "programmee_pour" | "segment_id">>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_campaigns")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteNewsletterCampaign(id: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  await supabase.from("newsletter_campaigns").delete().eq("id", id);
  return { ok: true };
}

// ─── Désinscription ────────────────────────────────────────────────────────────

export async function getPersonByUnsubscribeToken(
  token: string
): Promise<{ id: string; name: string; organization_id: string } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("id, name, organization_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  return data ?? null;
}

export async function unsubscribeByToken(token: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("persons")
    .update({ newsletter_opt_out: true })
    .eq("unsubscribe_token", token);
  return { ok: !error };
}

// ─── Résolution des destinataires ──────────────────────────────────────────────

export async function getNewsletterRecipients(
  orgId: string,
  segmentId: string | null
): Promise<{ name: string; email: string; unsubscribe_token: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  let query = supabase
    .from("persons")
    .select("name, email, unsubscribe_token")
    .eq("organization_id", orgId)
    .eq("newsletter_opt_out", false)
    .not("email", "is", null);

  if (segmentId) {
    const { data: links } = await supabase
      .from("member_group_links")
      .select("person_id")
      .eq("group_id", segmentId);
    const ids = (links ?? []).map((l) => l.person_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data } = await query;
  return (data ?? []).filter((r) => r.email) as { name: string; email: string; unsubscribe_token: string }[];
}

// ─── Pour le cron : toutes les settings actives ────────────────────────────────

export async function getAllActiveNewsletterSettings(): Promise<
  (NewsletterSettings & { org_slug: string; org_name: string; org_accent: string | null })[]
> {
  if (!isSupabaseConfigured()) return [];
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await admin
    .from("newsletter_settings")
    .select("*, organizations!inner(slug, name, primary_color)")
    .eq("actif", true);
  return (data ?? []).map((row: Record<string, unknown>) => {
    const org = row.organizations as { slug: string; name: string; primary_color: string } | null;
    return {
      ...(row as unknown as NewsletterSettings),
      org_slug: org?.slug ?? "",
      org_name: org?.name ?? "",
      org_accent: org?.primary_color ?? null,
    };
  });
}
