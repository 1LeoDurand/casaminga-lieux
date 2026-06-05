import type {
  Announcement,
  Automation,
  CommunityPost,
  Document,
  Evenement,
  ImpactIndicator,
  IncomingRequest,
  Mandate,
  Media,
  Meeting,
  MembershipApplication,
  MembershipCampaign,
  MembershipTier,
  Organization,
  Partner,
  Person,
  PublicSite,
  Reservation,
  Residence,
  Space,
  Task,
  Transaction,
} from "@/lib/types";

/**
 * Données de démonstration — mode seed mémoire (Supabase non configuré).
 * Utilisé uniquement quand isSupabaseConfigured() = false (dev local sans .env).
 * En production, Supabase est actif et ces tableaux ne sont jamais lus.
 *
 * Les vraies orgs de démo (is_demo=true en base) sont gérées
 * depuis /admin/demos et ne dépendent PAS de ce fichier.
 */

/** ID fictif stable pour le mode seed mémoire (non-Supabase). */
export const BK_ORG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: BK_ORG_ID,
    slug: "demo-tiers-lieu",
    name: "La Friche Commune (démo)",
    structure: "Association loi 1901",
    address: "",
    email: "",
    phone: null,
    website: "",
    description: "",
    hours: "",
    plan: "essentiel",
    primary_color: "#FF8A65",
    is_demo: true,
    demo_archetype: "tiers-lieu",
  },
];

export const DEMO_PUBLIC_SITES: PublicSite[] = [];
export const DEMO_REQUESTS: IncomingRequest[] = [];
export const DEMO_PERSONS: Person[] = [];
export const DEMO_SPACES: Space[] = [];
export const DEMO_RESERVATIONS: Reservation[] = [];
export const DEMO_EVENEMENTS: Evenement[] = [];
export const DEMO_RESIDENCES: Residence[] = [];
export const DEMO_DOCUMENTS: Document[] = [];
export const DEMO_TRANSACTIONS: Transaction[] = [];
export const DEMO_MEDIA: Media[] = [];
export const DEMO_ANNOUNCEMENTS: Announcement[] = [];
export const DEMO_TASKS: Task[] = [];
export const DEMO_COMMUNITY_POSTS: CommunityPost[] = [];
export const DEMO_MEETINGS: Meeting[] = [];
export const DEMO_MANDATES: Mandate[] = [];
export const DEMO_PARTNERS: Partner[] = [];
export const DEMO_IMPACT_INDICATORS: ImpactIndicator[] = [];
export const DEMO_AUTOMATIONS: Automation[] = [];
export const DEMO_MEMBERSHIP_CAMPAIGNS: MembershipCampaign[] = [];
export const DEMO_MEMBERSHIP_TIERS: MembershipTier[] = [];
export const DEMO_MEMBERSHIP_APPLICATIONS: MembershipApplication[] = [];

export function demoOrgBySlug(slug: string): Organization | undefined {
  return DEMO_ORGANIZATIONS.find((o) => o.slug === slug);
}

export function demoPublicSiteBySlug(slug: string): PublicSite | undefined {
  return DEMO_PUBLIC_SITES.find((s) => s.slug === slug && s.status === "publie");
}

export function demoRequestsForOrg(orgId: string): IncomingRequest[] {
  return DEMO_REQUESTS.filter((r) => r.organization_id === orgId);
}
