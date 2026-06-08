/**
 * Route cron : /api/cron/newsletters
 * Appelée quotidiennement par GitHub Actions.
 * Gère les 3 modes : récurrent, sur_evenement, programmée.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAllActiveNewsletterSettings } from "@/lib/newsletter/data";
import { resolveAllBlocks, countNewEventsSince } from "@/lib/newsletter/resolvers";
import { renderNewsletterHtml } from "@/lib/newsletter/renderer";
import { sendMail } from "@/lib/mail";
import { logCronRun } from "@/lib/cron-logger";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function sendToOrg(
  admin: ReturnType<typeof getAdmin>,
  orgId: string,
  orgSlug: string,
  orgName: string,
  orgAccent: string | null,
  segmentId: string | null,
  blocs: unknown[],
  sujet: string
): Promise<{ sent: number; failed: number }> {
  // Destinataires
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
    if (!ids.length) return { sent: 0, failed: 0 };
    query = query.in("id", ids);
  }

  const { data: recipients } = await query;
  const list = (recipients ?? []).filter((r: { email: string | null }) => r.email);
  if (!list.length) return { sent: 0, failed: 0 };

  // Résolution des blocs dynamiques
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveAllBlocks: resolveBlocks } = require("@/lib/newsletter/resolvers");
  const resolved = await resolveBlocks(orgId);

  let sent = 0;
  let failed = 0;

  for (const recipient of list as { name: string; email: string; unsubscribe_token: string }[]) {
    const unsubUrl = `${BASE_URL}/unsubscribe/${recipient.unsubscribe_token}`;
    const html = renderNewsletterHtml(blocs as never[], {
      orgName,
      orgSlug,
      accentColor: orgAccent ?? undefined,
      siteBase: BASE_URL,
      unsubscribeUrl: unsubUrl,
      ...resolved,
    });
    const ok = await sendMail({
      to: recipient.email,
      subject: sujet,
      html,
      category: "newsletter",
      organizationId: orgId,
    });
    if (ok) sent++; else failed++;
    await new Promise((r) => setTimeout(r, 50));
  }

  return { sent, failed };
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

  // ── 1. Campagnes programmées (toutes orgs) ─────────────────────────────────
  const { data: scheduled } = await admin
    .from("newsletter_campaigns")
    .select("id, organization_id, sujet, blocs, segment_id, organizations!inner(slug, name, primary_color)")
    .eq("statut", "programmee")
    .lte("programmee_pour", now.toISOString());

  for (const camp of scheduled ?? []) {
    const orgs = camp.organizations as { slug: string; name: string; primary_color: string }[] | { slug: string; name: string; primary_color: string } | null;
    const org = Array.isArray(orgs) ? orgs[0] : orgs;
    if (!org) continue;
    const { sent, failed } = await sendToOrg(
      admin, camp.organization_id, org.slug, org.name, org.primary_color,
      camp.segment_id, camp.blocs, camp.sujet
    );
    await admin.from("newsletter_campaigns").update({
      statut: "envoyee",
      envoyee_le: now.toISOString(),
      nb_envoyes: sent,
      nb_echecs: failed,
    }).eq("id", camp.id);
    results.push({ org: org.slug, mode: "programmee", sent });
  }

  // ── 2. Settings actives (récurrent + sur_evenement) ────────────────────────
  const settings = await getAllActiveNewsletterSettings();

  for (const s of settings) {
    if (!s.blocs_template || (s.blocs_template as unknown[]).length === 0) {
      results.push({ org: s.org_slug, mode: s.mode, skipped: "template vide" });
      continue;
    }

    // ── Mode récurrent ─────────────────────────────────────────────────────────
    if (s.mode === "recurrent") {
      if (!s.prochain_envoi_le || s.prochain_envoi_le > today) {
        results.push({ org: s.org_slug, mode: "recurrent", skipped: "pas encore le jour J" });
        continue;
      }
      const sujet = `Infolettre — ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now)}`;
      const { sent, failed } = await sendToOrg(
        admin, s.organization_id, s.org_slug, s.org_name, s.org_accent,
        s.segment_id, s.blocs_template as never[], sujet
      );
      // Calculer le prochain envoi
      const nextDate = new Date(now);
      nextDate.setDate(nextDate.getDate() + s.frequence_semaines * 7);
      const nextStr = nextDate.toISOString().split("T")[0];
      await admin.from("newsletter_settings").update({
        dernier_envoi_le: today,
        prochain_envoi_le: nextStr,
      }).eq("id", s.id);
      // Archiver la campagne envoyée
      await admin.from("newsletter_campaigns").insert({
        organization_id: s.organization_id,
        sujet,
        blocs: s.blocs_template,
        statut: "envoyee",
        envoyee_le: now.toISOString(),
        nb_envoyes: sent,
        nb_echecs: failed,
        segment_id: s.segment_id,
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
      const { sent, failed } = await sendToOrg(
        admin, s.organization_id, s.org_slug, s.org_name, s.org_accent,
        s.segment_id, s.blocs_template as never[], sujet
      );
      await admin.from("newsletter_settings").update({ dernier_envoi_le: today }).eq("id", s.id);
      await admin.from("newsletter_campaigns").insert({
        organization_id: s.organization_id,
        sujet,
        blocs: s.blocs_template,
        statut: "envoyee",
        envoyee_le: now.toISOString(),
        nb_envoyes: sent,
        nb_echecs: failed,
        segment_id: s.segment_id,
      });
      results.push({ org: s.org_slug, mode: "sur_evenement", sent });
    }
  }

  await logCronRun("newsletters", "ok", { rowsAffected: results.length });
  return NextResponse.json({ ok: true, processed: results.length, results });
}
