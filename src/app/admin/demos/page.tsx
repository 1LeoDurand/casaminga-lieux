import { createAdminClient } from "@/lib/admin/guard";
import { DemosView } from "@/components/admin/demos-view";

export const dynamic = "force-dynamic";

export interface DemoOrgRow {
  id: string;
  slug: string;
  name: string;
  demo_archetype: string | null;
  created_at: string;
}

async function getDemoOrgs(): Promise<DemoOrgRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("organizations")
    .select("id, slug, name, demo_archetype, created_at")
    .eq("is_demo", true)
    .order("created_at", { ascending: false });
  return (data as DemoOrgRow[]) ?? [];
}

export default async function DemosPage() {
  const demoOrgs = await getDemoOrgs();
  return <DemosView demoOrgs={demoOrgs} />;
}
