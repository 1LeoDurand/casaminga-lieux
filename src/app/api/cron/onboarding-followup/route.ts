import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Séquence d'onboarding email :
 *  - J+3 : email de check-in "Vous vous en sortez bien ?" (`tplOnboardingJ3`)
 *  - J+7 : invitation 1-to-1 30 min avec Léo (`tplOnboardingJ7`)
 *
 * Sécurisé par CRON_SECRET. Conçu pour tourner 1×/jour.
 * Anti-doublon : colonnes `onboarding_j3_sent_at` / `onboarding_j7_sent_at` sur organizations.
 * Exclut les orgs demo (is_demo = true).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const [{ sendMail }, { tplOnboardingJ3, tplOnboardingJ7 }] = await Promise.all([
    import("@/lib/mail"),
    import("@/lib/mail-templates"),
  ]);

  const DASHBOARD_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
  const CAL_URL = process.env.ONBOARDING_CAL_URL ?? "mailto:leo@casaminga.com?subject=Démo Casa Minga Lieux";

  // ── Fenêtre glissante : orgs créées il y a exactement N jours (fenêtres datées) ──
  function dayWindow(daysAgo: number): { start: string; end: string } {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // ── Helper : récupère le 1er admin d'une org ──
  async function getAdminContact(orgId: string): Promise<{ email: string; firstName: string } | null> {
    const { data } = await admin!
      .from("organization_members")
      .select("profiles(full_name, email)")
      .eq("organization_id", orgId)
      .eq("role", "admin")
      .eq("status", "actif")
      .limit(1)
      .single();
    if (!data) return null;
    const raw = data.profiles as unknown;
    const profile = raw as { full_name: string | null; email: string | null } | null;
    if (!profile?.email) return null;
    const firstName = (profile.full_name ?? "").split(" ")[0] || "vous";
    return { email: profile.email, firstName };
  }

  let j3Sent = 0;
  let j7Sent = 0;

  // ── J+3 ──
  const j3Window = dayWindow(3);
  const { data: j3Orgs } = await admin!
    .from("organizations")
    .select("id, name, slug")
    .is("onboarding_j3_sent_at", null)
    .neq("is_demo", true)
    .gte("created_at", j3Window.start)
    .lte("created_at", j3Window.end);

  for (const org of (j3Orgs ?? []) as { id: string; name: string; slug: string }[]) {
    const contact = await getAdminContact(org.id);
    if (!contact) continue;

    const ok = await sendMail({
      to: contact.email,
      subject: `Vous vous en sortez bien, ${contact.firstName} ?`,
      html: tplOnboardingJ3({
        orgName: org.name,
        firstName: contact.firstName,
        dashboardUrl: `${DASHBOARD_BASE}/dashboard/${org.slug}`,
      }),
      category: "bienvenue",
      organizationId: org.id,
    });

    if (ok) {
      await admin!
        .from("organizations")
        .update({ onboarding_j3_sent_at: new Date().toISOString() })
        .eq("id", org.id);
      j3Sent++;
    }
  }

  // ── J+7 ──
  const j7Window = dayWindow(7);
  const { data: j7Orgs } = await admin!
    .from("organizations")
    .select("id, name, slug")
    .is("onboarding_j7_sent_at", null)
    .neq("is_demo", true)
    .gte("created_at", j7Window.start)
    .lte("created_at", j7Window.end);

  for (const org of (j7Orgs ?? []) as { id: string; name: string; slug: string }[]) {
    const contact = await getAdminContact(org.id);
    if (!contact) continue;

    const ok = await sendMail({
      to: contact.email,
      subject: `Un coup de main pour ${org.name} ?`,
      html: tplOnboardingJ7({
        orgName: org.name,
        firstName: contact.firstName,
        dashboardUrl: `${DASHBOARD_BASE}/dashboard/${org.slug}`,
        calUrl: CAL_URL,
      }),
      category: "bienvenue",
      organizationId: org.id,
    });

    if (ok) {
      await admin!
        .from("organizations")
        .update({ onboarding_j7_sent_at: new Date().toISOString() })
        .eq("id", org.id);
      j7Sent++;
    }
  }

  await logCronRun("onboarding-followup", "ok", { rowsAffected: j3Sent + j7Sent });
  return NextResponse.json({ ok: true, j3Sent, j7Sent });
}
