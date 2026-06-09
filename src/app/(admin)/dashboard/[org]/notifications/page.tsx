import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { NotificationsView, type AppNotification } from "@/components/mc/notifications-view";
import { getOrganizationBySlug } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function NotificationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  let notifications: AppNotification[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("organization_id", organization.id)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(100);
      notifications = (data ?? []) as AppNotification[];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Système"
        title="Notifications"
        sub="Toutes les alertes et événements importants de votre espace."
      />
      <NotificationsView notifications={notifications} orgSlug={org} orgId={organization.id} />
    </div>
  );
}
