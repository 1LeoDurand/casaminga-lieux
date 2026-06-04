import { notFound, redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/mc/dashboard-sidebar";
import { DashboardTopbar } from "@/components/mc/dashboard-topbar";
import { FeedbackWidget } from "@/components/mc/feedback-widget";
import { HelpWidget } from "@/components/mc/help-widget";
import { getOrganizationBySlug, getRequestsForOrg } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/admin/guard";

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

  const requests = await getRequestsForOrg(organization.id);
  const openRequests = requests.filter(
    (r) => !OPEN_STATUSES_EXCLUDED.includes(r.status)
  ).length;

  return (
    <div className="grid h-screen grid-cols-[232px_1fr] grid-rows-[56px_1fr] overflow-hidden">
      <div className="row-span-2 overflow-hidden">
        <DashboardSidebar
          orgSlug={organization.slug}
          orgName={organization.name}
          openRequests={openRequests}
          isDemo={!isSupabaseConfigured()}
        />
      </div>
      <DashboardTopbar orgSlug={organization.slug} />
      <main className="overflow-y-auto p-7">{children}</main>
      <FeedbackWidget orgSlug={organization.slug} />
      <HelpWidget />
    </div>
  );
}
