import { notFound } from "next/navigation";
import { DashboardSidebar } from "@/components/mc/dashboard-sidebar";
import { DashboardTopbar } from "@/components/mc/dashboard-topbar";
import { FeedbackWidget } from "@/components/mc/feedback-widget";
import { getOrganizationBySlug, getRequestsForOrg } from "@/lib/data";

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
        />
      </div>
      <DashboardTopbar orgSlug={organization.slug} />
      <main className="overflow-y-auto p-7">{children}</main>
      <FeedbackWidget orgSlug={organization.slug} />
    </div>
  );
}
