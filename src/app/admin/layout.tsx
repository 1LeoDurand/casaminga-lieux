import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getPlatformStats, getModerationPendingCount, getClaimsPendingCount } from "@/lib/admin/data";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const [stats, moderationPending, claimsPending] = await Promise.all([
    getPlatformStats(),
    getModerationPendingCount(),
    getClaimsPendingCount(),
  ]);

  return (
    <AdminShell
      email={email}
      feedbackOpen={stats.feedbackOpen}
      moderationPending={moderationPending}
      claimsPending={claimsPending}
    >
      {children}
    </AdminShell>
  );
}
