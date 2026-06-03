import "server-only";
import { createAdminClient } from "./guard";

export interface PlatformStats {
  orgs: number;
  members: number;
  feedbackOpen: number;
  feedbackTotal: number;
  signups30d: number;
  recentOrgs: { slug: string; name: string; created_at: string; plan: string }[];
}

export interface OrgRow {
  id: string;
  slug: string;
  name: string;
  structure: string | null;
  plan: string;
  email: string | null;
  created_at: string;
  memberCount: number;
}

export interface FeedbackRow {
  id: string;
  type: string;
  priority: string;
  description: string;
  url: string | null;
  page_title: string | null;
  org_slug: string | null;
  status: string;
  created_at: string;
}

/** Statistiques globales de la plateforme. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();
  if (!admin) {
    return { orgs: 0, members: 0, feedbackOpen: 0, feedbackTotal: 0, signups30d: 0, recentOrgs: [] };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [orgsC, membersC, fbOpenC, fbTotalC, signupsC, recent] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("organization_members").select("user_id", { count: "exact", head: true }),
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("feedback").select("id", { count: "exact", head: true }),
    admin.from("organizations").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("organizations")
      .select("slug, name, created_at, plan")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    orgs: orgsC.count ?? 0,
    members: membersC.count ?? 0,
    feedbackOpen: fbOpenC.count ?? 0,
    feedbackTotal: fbTotalC.count ?? 0,
    signups30d: signupsC.count ?? 0,
    recentOrgs: recent.data ?? [],
  };
}

/** Toutes les organisations avec leur nombre de membres. */
export async function getAllOrganizations(): Promise<OrgRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, slug, name, structure, plan, email, created_at")
    .order("created_at", { ascending: false });

  if (!orgs) return [];

  const { data: members } = await admin
    .from("organization_members")
    .select("organization_id");

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    counts.set(m.organization_id, (counts.get(m.organization_id) ?? 0) + 1);
  }

  return orgs.map((o) => ({ ...o, memberCount: counts.get(o.id) ?? 0 }));
}

/** Tous les tickets feedback, plus récents en premier. */
export async function getAllFeedback(): Promise<FeedbackRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("feedback")
    .select("id, type, priority, description, url, page_title, org_slug, status, created_at")
    .order("created_at", { ascending: false });

  return data ?? [];
}
