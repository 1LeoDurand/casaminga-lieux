import { notFound } from "next/navigation";
import { DashboardSidebar } from "@/components/mc/dashboard-sidebar";
import { DashboardTopbar } from "@/components/mc/dashboard-topbar";
import { getOrganizationBySlug } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

  return (
    <div className="grid h-screen grid-cols-[232px_1fr] grid-rows-[56px_1fr] overflow-hidden">
      <div className="row-span-2 overflow-hidden">
        <DashboardSidebar orgSlug={organization.slug} orgName={organization.name} />
      </div>
      <DashboardTopbar
        orgName={organization.name}
        orgSlug={organization.slug}
        demoMode={!isSupabaseConfigured()}
      />
      <main className="overflow-y-auto p-8">{children}</main>
    </div>
  );
}
