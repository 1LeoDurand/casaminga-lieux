import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getModerationPendingCount, getClaimsPendingCount, getFeedbackCountsByPlatform } from "@/lib/admin/data";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { getOutreachPendingCount } from "@/lib/outreach/data";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const [moderationPending, claimsPending, outreachPending, initialPlatform, feedbackByPlatform] = await Promise.all([
    getModerationPendingCount(),
    getClaimsPendingCount(),
    // Threads "à toi" of the contacts module (0 if the module is unreachable).
    getOutreachPendingCount(),
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
        outreachPending={outreachPending}
        initialPlatform={initialPlatform}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
