import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardSidebar } from "@/components/mc/dashboard-sidebar";
import { DashboardTopbar } from "@/components/mc/dashboard-topbar";
import { FeedbackWidget } from "@/components/mc/feedback-widget";
import { HelpWidget } from "@/components/mc/help-widget";
import { getOrganizationBySlug, getRequestsForOrg } from "@/lib/data";
import { getActiveEstablishments } from "@/lib/establishments";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/admin/guard";
import { getEnabledModules, getOrgSubscription, effectiveTier } from "@/lib/modules-data";

const OPEN_STATUSES_EXCLUDED = ["validee", "refusee", "archivee"];

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  // ── Vérification d'authentification ──────────────────────────────────────
  // En mode démo (Supabase non configuré) on laisse passer sans auth.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Pas connecté → redirige vers /login avec retour après connexion
      redirect(`/login?redirect=/dashboard/${org}`);
    }

    // Vérifie que l'user est membre de cet org OU super-admin
    const isSuperAdmin = isSuperAdminEmail(user.email);
    if (!isSuperAdmin) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("user_id", user.id)
        .eq("status", "actif")
        .maybeSingle();

      if (!membership) {
        // Connecté mais pas membre de cet org
        redirect("/login?error=unauthorized");
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Compte de notifications non lues
  let unreadNotifCount = 0;
  if (isSupabaseConfigured()) {
    const supabase2 = await createClient();
    const { data: { user: u2 } } = await supabase2.auth.getUser();
    if (u2) {
      const { count } = await supabase2
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .or(`user_id.eq.${u2.id},user_id.is.null`)
        .is("read_at", null);
      unreadNotifCount = count ?? 0;
    }
  }

  const [requests, enabledModules, subscription, establishments] = await Promise.all([
    getRequestsForOrg(organization.id),
    getEnabledModules(organization.id),
    getOrgSubscription(organization.id),
    getActiveEstablishments(organization.id),
  ]);
  const openRequests = requests.filter(
    (r) => !OPEN_STATUSES_EXCLUDED.includes(r.status)
  ).length;
  const orgTier = effectiveTier(subscription);

  // Lieu sélectionné (switcher topbar) — persisté en cookie par org
  const cookieStore = await cookies();
  const rawLieuId = cookieStore.get(`cm_lieu_${organization.slug}`)?.value ?? null;
  const selectedLieuId = establishments.some((e) => e.id === rawLieuId) ? rawLieuId : null;
  const lieuOptions = establishments.map((e) => ({ id: e.id, name: e.name, slug: e.slug, city: e.city }));

  return (
    <div className="grid h-screen grid-cols-[232px_1fr] grid-rows-[56px_1fr] overflow-hidden">
      <div className="row-span-2 overflow-hidden">
        <DashboardSidebar
          orgSlug={organization.slug}
          orgName={organization.name}
          openRequests={openRequests}
          isDemo={!isSupabaseConfigured()}
          enabledModules={enabledModules}
          orgTier={orgTier}
        />
      </div>
      <DashboardTopbar orgSlug={organization.slug} establishments={lieuOptions} selectedLieuId={selectedLieuId} unreadNotifCount={unreadNotifCount} />
      <main className="overflow-y-auto p-7">{children}</main>
      <FeedbackWidget orgSlug={organization.slug} />
      <HelpWidget />
    </div>
  );
}
