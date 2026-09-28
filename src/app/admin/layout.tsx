import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getModerationPendingCount, getClaimsPendingCount, getFeedbackCountsByPlatform } from "@/lib/admin/data";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const [moderationPending, claimsPending, initialPlatform, feedbackByPlatform] = await Promise.all([
    getModerationPendingCount(),
    getClaimsPendingCount(),
    // Un layout App Router ne reçoit pas les searchParams : seul le cookie
    // est lisible ici. La query `?plateforme=` (si présente) est lue et prime
    // côté client, dans AdminShell.
    getAdminPlatform(),
    // Groupé par plateforme, une seule requête : le badge de la sidebar
    // affiche le compte de la plateforme courante et signale le reste
    // ("+N ailleurs") sans relancer une requête par plateforme (prompt 6).
    getFeedbackCountsByPlatform(),
  ]);

  return (
    <Suspense>
      <AdminShell
        email={email}
        feedbackByPlatform={feedbackByPlatform}
        moderationPending={moderationPending}
        claimsPending={claimsPending}
        initialPlatform={initialPlatform}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
