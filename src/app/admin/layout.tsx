import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getPlatformStats, getModerationPendingCount, getClaimsPendingCount } from "@/lib/admin/data";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const [stats, moderationPending, claimsPending, initialPlatform] = await Promise.all([
    getPlatformStats(),
    getModerationPendingCount(),
    getClaimsPendingCount(),
    // Un layout App Router ne reçoit pas les searchParams : seul le cookie
    // est lisible ici. La query `?plateforme=` (si présente) est lue et prime
    // côté client, dans AdminShell.
    getAdminPlatform(),
  ]);

  return (
    <Suspense>
      <AdminShell
        email={email}
        feedbackOpen={stats.feedbackOpen}
        moderationPending={moderationPending}
        claimsPending={claimsPending}
        initialPlatform={initialPlatform}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
