import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getPlatformStats } from "@/lib/admin/data";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Administration — Casa Minga Lieux",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperAdmin();
  const stats = await getPlatformStats();

  return (
    <div className="grid h-screen grid-cols-[232px_1fr] overflow-hidden bg-cream">
      <AdminSidebar email={email} feedbackOpen={stats.feedbackOpen} />
      <main className="overflow-y-auto p-8">{children}</main>
    </div>
  );
}
