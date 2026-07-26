/**
 * Route cron : /api/cron/newsletters
 * Appelée quotidiennement par GitHub Actions.
 * Gère les 3 modes : récurrent, sur_evenement, programmée.
 *
 * Principe d'envoi : toute campagne est d'abord *réservée* (statut `en_cours`),
 * puis envoyée destinataire par destinataire avec un registre. Un passage
 * interrompu est repris là où il s'est arrêté au lieu de tout recommencer.
 * Voir src/lib/newsletter/send.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAllActiveNewsletterSettings } from "@/lib/newsletter/data";
import { resolveAllBlocks, countNewEventsSince } from "@/lib/newsletter/resolvers";
import { renderNewsletterHtml } from "@/lib/newsletter/renderer";
import {
  claimCampaign,
  sendCampaignBatch,
  finalizeCampaign,
  STALE_SEND_MINUTES,
  type DeliveryRecipient,
} from "@/lib/newsletter/send";
import { logCronRun } from "@/lib/cron-logger";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type OrgLite = { slug: string; name: string; primary_color: string | null };

function pickOrg(raw: unknown): OrgLite | null {
  const org = Array.isArray(raw) ? raw[0] : raw;
  return (org as OrgLite) ?? null;
}

async function loadRecipients(
  admin: ReturnType<typeof getAdmin>,
  orgId: string,
  segmentId: string | null
): Promise<DeliveryRecipient[]> {
  let query = admin
    .from("persons")
    .select("name, email, unsubscribe_token")
    .eq("organization_id", orgId)
    .eq("newsletter_opt_out", false)
    .not("email", "is", null);

  if (segmentId) {
    const { data: links } = await admin
      .from("member_group_links")
      .select("person_id")
      .eq("group_id", segmentId);
    const ids = (links ?? []).map((l: { person_id: string }) => l.person_id);
    if (!ids.length) return [];
    query = query.in("id", ids);
  }

  const { data } = await query;
  return ((data ?? []) as DeliveryRecipient[]).filter((r) => r.email);
}

/** Envoie une campagne DÉJÀ réservée, puis la clôt. */
async function runCampaign(
  admin: ReturnType<typeof getAdmin>,
  params: {
    campaignId: string;
    orgId: string;
    org: OrgLite;
    segmentId: string | null;
    blocs: unknown[];
    sujet: string;
  }
): Promise<{ sent: number; failed: number; skipped: number }> {
  const { campaignId, orgId, org, segmentId, blocs, sujet } = params;

  const recipients = await loadRecipients(admin, orgId, segmentId);
  if (!recipients.length) {
    await finalizeCampaign(campaignId, { sent: 0, failed: 0 });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const resolved = await resolveAllBlocks(orgId);

  const counts = await sendCampaignBatch({
    campaignId,
    organizationId: orgId,
    sujet,
    recipients,
    baseUrl: BASE_URL,
    renderHtml: (recipient) =>
      renderNewsletterHtml(blocs as never[], {
        orgName: org.name,
        orgSlug: org.slug,
        accentColor: org.primary_color ?? undefined,
        siteBase: BASE_URL,
        unsubscribeUrl: `${BASE_URL}/unsubscribe/${recipient.unsubscribe_token}`,
        ...resolved,
      }),
  });

  await finalizeCampaign(campaignId, counts);
  return counts;
}

/**
 * Crée la campagne AVANT d'envoyer, pour les modes automatiques.
 * L'ordre compte : sans ligne en base, un envoi interrompu ne laisse aucune
 * trace de ce qui est déjà parti.
 */
async function openAutoCampaign(
  admin: ReturnType<typeof getAdmin>,
  input: { orgId: string; sujet: string; blocs: unknown[]; segmentId: string | null }
): Promise<string | null> {
  const { data } = await admin
    .from("newsletter_campaigns")
    .insert({
      organization_id: input.orgId,
      sujet: input.sujet,
      blocs: input.blocs,
      segment_id: input.segmentId,
      statut: "en_cours",
      envoi_demarre_le: new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  // Authentification cron
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const now = new Date();

  const results: { org: string; mode: string; sent?: number; skipped?: string }[] = [];

  // ── 0. Reprises : envois restés en plan ────────────────────────────────────
  const staleBefore = new Date(now.getTime() - STALE_SEND_MINUTES * 60_000).toISOString();
  const { data: interrupted } = await admin
    .from("newsletter_campaigns")
    .select("id, organization_id, sujet, blocs, segment_id, organizations!inner(slug, name, primary_color)")
    .eq("statut", "en_cours")
    .lt("envoi_demarre_le", staleBefore);

  for (const camp of interrupted ?? []) {
    const org = pickOrg(camp.organizations);
    if (!org) continue;
    if (!(await claimCampaign(camp.id, { resumeStale: true }))) continue;
    const { sent, skipped } = await runCampaign(admin, {
      campaignId: camp.id,
      orgId: camp.organization_id,
      org,
      segmentId: camp.segment_id,
      blocs: camp.blocs,
      sujet: camp.sujet,
    });
    results.push({ org: org.slug, mode: "reprise", sent, skipped: `${skipped} deja servi(s)` });
  }

  // ── 1. Campagnes programmées (toutes orgs) ─────────────────────────────────
  const { data: scheduled } = await admin
    .from("newsletter_campaigns")
    .select("id, organization_id, sujet, blocs, segment_id, organizations!inner(slug, name, primary_color)")
    .eq("statut", "programmee")
    .lte("programmee_pour", now.toISOString());

  for (const camp of scheduled ?? []) {
    const org = pickOrg(camp.organizations);
    if (!org) continue;
    // Réservation : si elle échoue, un autre passage s'en occupe déjà.
    if (!(await claimCampaign(camp.id))) {
      results.push({ org: org.slug, mode: "programmee", skipped: "envoi deja en cours" });
      continue;
    }
    const { sent } = await runCampaign(admin, {
      campaignId: camp.id,
      orgId: camp.organization_id,
      org,
      segmentId: camp.segment_id,
      blocs: camp.blocs,
      sujet: camp.sujet,
    });
    results.push({ org: org.slug, mode: "programmee", sent });
  }

  // ── 2. Settings actives (récurrent + sur_evenement) ────────────────────────
  const settings = await getAllActiveNewsletterSettings();

  for (const s of settings) {
    if (!s.blocs_template || (s.blocs_template as unknown[]).length === 0) {
      results.push({ org: s.org_slug, mode: s.mode, skipped: "template vide" });
      continue;
    }
    const org: OrgLite = { slug: s.org_slug, name: s.org_name, primary_color: s.org_accent };

    // ── Mode récurrent ─────────────────────────────────────────────────────────
    if (s.mode === "recurrent") {
      if (!s.prochain_envoi_le || s.prochain_envoi_le > today) {
        results.push({ org: s.org_slug, mode: "recurrent", skipped: "pas encore le jour J" });
        continue;
      }
      const sujet = `Newsletter — ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now)}`;

      // On avance la cadence AVANT d'envoyer : si l'envoi s'interrompt, c'est la
      // reprise qui le termine. Laisser la date en arrière ferait repartir une
      // campagne entière le lendemain.
      const nextDate = new Date(now);
      nextDate.setDate(nextDate.getDate() + s.frequence_semaines * 7);
      await admin.from("newsletter_settings").update({
        dernier_envoi_le: today,
        prochain_envoi_le: nextDate.toISOString().split("T")[0],
      }).eq("id", s.id);

      const campaignId = await openAutoCampaign(admin, {
        orgId: s.organization_id, sujet, blocs: s.blocs_template as unknown[], segmentId: s.segment_id,
      });
      if (!campaignId) {
        results.push({ org: s.org_slug, mode: "recurrent", skipped: "creation campagne impossible" });
        continue;
      }
      const { sent } = await runCampaign(admin, {
        campaignId, orgId: s.organization_id, org, segmentId: s.segment_id,
        blocs: s.blocs_template as unknown[], sujet,
      });
      results.push({ org: s.org_slug, mode: "recurrent", sent });
    }

    // ── Mode sur_evenement ─────────────────────────────────────────────────────
    else if (s.mode === "sur_evenement") {
      // Garde-fou : pas plus d'une NL tous les garde_fou_jours
      if (s.dernier_envoi_le) {
        const lastSend = new Date(s.dernier_envoi_le);
        const daysSince = Math.floor((now.getTime() - lastSend.getTime()) / 86400000);
        if (daysSince < s.garde_fou_jours) {
          results.push({ org: s.org_slug, mode: "sur_evenement", skipped: `garde-fou (${daysSince}/${s.garde_fou_jours} j)` });
          continue;
        }
      }
      // Compter les nouveaux événements depuis le dernier envoi
      const since = s.dernier_envoi_le
        ? new Date(s.dernier_envoi_le).toISOString()
        : new Date(0).toISOString();
      const newEvts = await countNewEventsSince(s.organization_id, since);
      if (newEvts < s.nb_evenements_declencheur) {
        results.push({ org: s.org_slug, mode: "sur_evenement", skipped: `seulement ${newEvts} nouv. événement(s)` });
        continue;
      }
      const sujet = `Nouveautés — ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now)}`;

      // Même raison que ci-dessus : le garde-fou est posé avant l'envoi.
      await admin.from("newsletter_settings").update({ dernier_envoi_le: today }).eq("id", s.id);

      const campaignId = await openAutoCampaign(admin, {
        orgId: s.organization_id, sujet, blocs: s.blocs_template as unknown[], segmentId: s.segment_id,
      });
      if (!campaignId) {
        results.push({ org: s.org_slug, mode: "sur_evenement", skipped: "creation campagne impossible" });
        continue;
      }
      const { sent } = await runCampaign(admin, {
        campaignId, orgId: s.organization_id, org, segmentId: s.segment_id,
        blocs: s.blocs_template as unknown[], sujet,
      });
      results.push({ org: s.org_slug, mode: "sur_evenement", sent });
    }
  }

  await logCronRun("newsletters", "ok", { rowsAffected: results.length });
  return NextResponse.json({ ok: true, processed: results.length, results });
}
