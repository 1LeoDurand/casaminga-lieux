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
  screenshot_url: string | null;
  created_at: string;
  // Infos environnement (migration feedback_device_info)
  user_agent: string | null;
  device_type: string | null;
  screen_width: number | null;
  screen_height: number | null;
  os_hint: string | null;
}

/** Statistiques globales de la plateforme. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();
  if (!admin) {
    return { orgs: 0, members: 0, feedbackOpen: 0, feedbackTotal: 0, signups30d: 0, recentOrgs: [] };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [orgsC, membersC, fbOpenC, fbTotalC, signupsC, recent] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }).eq("is_demo", false),
    admin.from("organization_members").select("user_id", { count: "exact", head: true }),
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("feedback").select("id", { count: "exact", head: true }),
    admin.from("organizations").select("id", { count: "exact", head: true }).eq("is_demo", false).gte("created_at", since),
    admin
      .from("organizations")
      .select("slug, name, created_at, plan")
      .eq("is_demo", false)
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
    .eq("is_demo", false)
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

export interface HelpArticleAdmin {
  slug: string;
  category_slug: string | null;
  title: string;
  excerpt: string | null;
  keywords: string[];
  body: string;
  published: boolean;
  view_count: number;
  helpful_yes: number;
  helpful_no: number;
}

export interface HelpCategoryAdmin {
  slug: string;
  label: string;
  icon: string;
  description: string | null;
}

export async function getAllHelpArticles(): Promise<HelpArticleAdmin[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("help_articles")
    .select("slug, category_slug, title, excerpt, keywords, body, published, view_count, helpful_yes, helpful_no, sort_order")
    .order("sort_order", { ascending: true });
  return (data as HelpArticleAdmin[]) ?? [];
}

export async function getAllHelpCategories(): Promise<HelpCategoryAdmin[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("help_categories")
    .select("slug, label, icon, description, sort_order")
    .order("sort_order", { ascending: true });
  return (data as HelpCategoryAdmin[]) ?? [];
}

// ── Santé technique ───────────────────────────────────────────────────────────

export interface CronLastRun {
  job_key: string;
  status: string;
  ran_at: string | null;
  rows_affected: number | null;
  error_msg: string | null;
}

export interface EmailDeliverability {
  total7d: number;
  sent7d: number;
  failed7d: number;
  rate7d: number;         // % de succès
  lastFailure: string | null;
  lastFailureMsg: string | null;
}

const KNOWN_CRONS = ["coworking-invoices", "payment-reminders", "reminders", "newsletters"];

export async function getHealthStats(): Promise<{ crons: CronLastRun[]; email: EmailDeliverability }> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      crons: KNOWN_CRONS.map((k) => ({ job_key: k, status: "unknown", ran_at: null, rows_affected: null, error_msg: null })),
      email: { total7d: 0, sent7d: 0, failed7d: 0, rate7d: 100, lastFailure: null, lastFailureMsg: null },
    };
  }

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [cronRes, emailRes, lastFailRes] = await Promise.all([
    // Dernière exécution de chaque job connu
    admin.from("cron_log").select("job_key, status, ran_at, rows_affected, error_msg")
      .in("job_key", KNOWN_CRONS)
      .order("ran_at", { ascending: false })
      .limit(50),
    // Stats email 7j
    admin.from("email_log").select("id, status, created_at", { count: "exact" }).gte("created_at", since7d),
    // Dernier échec email
    admin.from("email_log").select("created_at, error").eq("status", "failed").order("created_at", { ascending: false }).limit(1),
  ]);

  // Dédupliquer crons → garder la dernière par job_key
  const cronMap = new Map<string, CronLastRun>();
  for (const r of (cronRes.data ?? [])) {
    if (!cronMap.has(r.job_key)) cronMap.set(r.job_key, r as CronLastRun);
  }
  const crons = KNOWN_CRONS.map((k) => cronMap.get(k) ?? { job_key: k, status: "jamais", ran_at: null, rows_affected: null, error_msg: null });

  const emails = emailRes.data ?? [];
  const sent7d = emails.filter((e) => e.status === "sent").length;
  const failed7d = emails.filter((e) => e.status === "failed").length;
  const total7d = emails.length;
  const lf = (lastFailRes.data ?? [])[0];

  return {
    crons,
    email: {
      total7d, sent7d, failed7d,
      rate7d: total7d > 0 ? Math.round((sent7d / total7d) * 100) : 100,
      lastFailure: lf?.created_at ?? null,
      lastFailureMsg: lf?.error ?? null,
    },
  };
}

import type { GrantOpportunity } from "@/lib/grants/types";

export async function getAllOpportunities(): Promise<GrantOpportunity[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("grant_opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as GrantOpportunity[]) ?? [];
}

export interface EmailLogRow {
  id: string;
  organization_id: string | null;
  recipient: string;
  subject: string;
  category: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export async function getRecentEmails(limit = 200): Promise<EmailLogRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("email_log")
    .select("id, organization_id, recipient, subject, category, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as EmailLogRow[]) ?? [];
}

export interface SubscriptionRow {
  organization_id: string;
  tier: string;
  status: string;
  comped: boolean;
  founding_member: boolean;
  notes: string | null;
}

/** Tous les abonnements (pour la page admin organisations). */
export async function getAllSubscriptions(): Promise<SubscriptionRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("subscriptions")
    .select("organization_id, tier, status, comped, founding_member, notes");
  return (data as SubscriptionRow[]) ?? [];
}

// ── Engagement ────────────────────────────────────────────────────────────────

export interface OrgEngagementRow {
  id: string;
  slug: string;
  name: string;
  structure: string | null;
  created_at: string;
  memberCount: number;
  lastSeenAt: string | null;          // max(last_seen_at) de ses membres
  enabledModules: string[];           // clés des modules activés
  tier: string;                       // tier abonnement
  founding_member: boolean;
  comped: boolean;
}

export type ActivityBucket = "active" | "recent" | "dormant" | "never";

export function activityBucket(lastSeenAt: string | null): ActivityBucket {
  if (!lastSeenAt) return "never";
  const days = (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000;
  if (days <= 7) return "active";
  if (days <= 30) return "recent";
  return "dormant";
}

export async function getEngagementStats(): Promise<OrgEngagementRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const [orgsRes, membersRes, modulesRes, subsRes] = await Promise.all([
    admin.from("organizations").select("id, slug, name, structure, created_at").eq("is_demo", false).order("created_at", { ascending: false }),
    admin.from("organization_members").select("organization_id, last_seen_at, status"),
    admin.from("organization_modules").select("organization_id, module_key, enabled"),
    admin.from("subscriptions").select("organization_id, tier, founding_member, comped"),
  ]);

  const orgs = orgsRes.data ?? [];
  const members = membersRes.data ?? [];
  const modules = modulesRes.data ?? [];
  const subs = subsRes.data ?? [];

  // Agréger par org
  const memberCountMap = new Map<string, number>();
  const lastSeenMap = new Map<string, string>();
  for (const m of members) {
    if (m.status !== "actif") continue;
    memberCountMap.set(m.organization_id, (memberCountMap.get(m.organization_id) ?? 0) + 1);
    const cur = lastSeenMap.get(m.organization_id);
    if (!cur || (m.last_seen_at && m.last_seen_at > cur)) {
      lastSeenMap.set(m.organization_id, m.last_seen_at);
    }
  }

  const modulesMap = new Map<string, string[]>();
  for (const mod of modules) {
    if (!mod.enabled) continue;
    const list = modulesMap.get(mod.organization_id) ?? [];
    list.push(mod.module_key);
    modulesMap.set(mod.organization_id, list);
  }

  const subMap = new Map(subs.map((s) => [s.organization_id, s]));

  return orgs.map((o) => {
    const sub = subMap.get(o.id);
    return {
      id: o.id,
      slug: o.slug,
      name: o.name,
      structure: o.structure,
      created_at: o.created_at,
      memberCount: memberCountMap.get(o.id) ?? 0,
      lastSeenAt: lastSeenMap.get(o.id) ?? null,
      enabledModules: modulesMap.get(o.id) ?? [],
      tier: sub?.tier ?? "free",
      founding_member: sub?.founding_member ?? false,
      comped: sub?.comped ?? false,
    };
  });
}

/** Tous les tickets feedback, plus récents en premier. */
export async function getAllFeedback(): Promise<FeedbackRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("feedback")
    .select("id, type, priority, description, url, page_title, org_slug, status, screenshot_url, created_at, user_agent, device_type, screen_width, screen_height, os_hint")
    .order("created_at", { ascending: false });

  return data ?? [];
}
