import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getPlatformStats, getModerationPendingCount } from "@/lib/admin/data";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const [stats, moderationPending] = await Promise.all([getPlatformStats(), getModerationPendingCount()]);

  return (
    <AdminShell email={email} feedbackOpen={stats.feedbackOpen} moderationPending={moderationPending}>
      {children}
    </AdminShell>
  );
}
