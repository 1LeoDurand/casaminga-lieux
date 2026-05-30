import type { IncomingRequest, Organization, Person, PublicSite } from "@/lib/types";

/**
 * Données de démonstration — Tiers-lieu Bernard Kohn.
 * Miroir de supabase/seed.sql. Servent tant que Supabase n'est pas configuré
 * (mode démo). Ne JAMAIS utiliser comme base de données de production.
 */

export const BK_ORG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: BK_ORG_ID,
    slug: "bernard-kohn",
    name: "Tiers-lieu Bernard Kohn",
    structure: "Association loi 1901",
    address: "Saint-Mandé (94)",
    email: "contact@bernard-kohn.org",
    phone: "+33 1 00 00 00 00",
    website: "https://casaminga.com/bernard-kohn",
    description:
      "Ancienne maison et atelier de l'architecte Bernard Kohn, devenue tiers-lieu : ateliers, résidences, espaces partagés et programmation culturelle au service du collectif.",
    hours: "Du mardi au samedi, 9h–19h",
    plan: "essentiel",
    primary_color: "#FF8A65",
  },
];

export const DEMO_PUBLIC_SITES: PublicSite[] = [
  {
    organization_id: BK_ORG_ID,
    slug: "bernard-kohn",
    title: "Tiers-lieu Bernard Kohn",
    status: "publie",
    seo_description:
      "Tiers-lieu à Saint-Mandé : ateliers, résidences artistiques, espaces partagés et événements ouverts au public.",
  },
];

export const DEMO_REQUESTS: IncomingRequest[] = [
  {
    id: "req-1",
    organization_id: BK_ORG_ID,
    name: "Camille Aubry",
    email: "camille.aubry@example.org",
    phone: "+33 6 12 34 56 78",
    organization_ext: "Atelier Terre & Feu",
    type: "residence",
    status: "nouvelle",
    priority: "haute",
    summary: "Demande de résidence artistique (céramique) — 3 semaines",
    message:
      "Bonjour, je suis céramiste et je souhaiterais candidater pour une résidence cet automne.",
    received_at: "2026-05-19",
  },
  {
    id: "req-2",
    organization_id: BK_ORG_ID,
    name: "Studio Halle Nord",
    email: "contact@hallenord.fr",
    phone: null,
    organization_ext: "Studio Halle Nord",
    type: "reservation",
    status: "etudier",
    priority: "normale",
    summary: "Réservation de la grande salle pour une exposition (week-end)",
    message: "Nous cherchons un espace pour une exposition collective sur deux jours.",
    received_at: "2026-05-17",
  },
  {
    id: "req-3",
    organization_id: BK_ORG_ID,
    name: "Mairie de Saint-Mandé",
    email: "culture@saintmande.fr",
    phone: "+33 1 49 57 78 00",
    organization_ext: "Mairie de Saint-Mandé",
    type: "partenariat",
    status: "attente",
    priority: "haute",
    summary: "Proposition de partenariat sur la programmation jeunesse",
    message: "Nous aimerions échanger sur un partenariat autour des ateliers jeunesse.",
    received_at: "2026-05-15",
  },
];

const NOW = "2026-05-20T09:00:00.000Z";

export const DEMO_PERSONS: Person[] = [
  {
    id: "c1111111-1111-4111-8111-111111111111",
    organization_id: BK_ORG_ID,
    name: "Camille Aubry",
    email: "camille.aubry@example.org",
    phone: "+33 6 12 34 56 78",
    role: "resident",
    status: "actif",
    tags: ["céramique", "résidence"],
    notes: "Céramiste en résidence à l'automne.",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "c2222222-2222-4222-8222-222222222222",
    organization_id: BK_ORG_ID,
    name: "Sofiane Merabet",
    email: "sofiane.merabet@example.org",
    phone: "+33 6 23 45 67 89",
    role: "coworker",
    status: "actif",
    tags: ["design", "abonné"],
    notes: "Coworker régulier, poste fixe.",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    organization_id: BK_ORG_ID,
    name: "Awa Diop",
    email: "awa.diop@example.org",
    phone: null,
    role: "benevole",
    status: "actif",
    tags: ["accueil", "événements"],
    notes: "Bénévole sur les événements du week-end.",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "c4444444-4444-4444-8444-444444444444",
    organization_id: BK_ORG_ID,
    name: "Léa Fontaine",
    email: "lea.fontaine@example.org",
    phone: "+33 6 34 56 78 90",
    role: "intervenant",
    status: "actif",
    tags: ["atelier", "poterie"],
    notes: "Intervenante ateliers poterie.",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "c5555555-5555-4555-8555-555555555555",
    organization_id: BK_ORG_ID,
    name: "Marc Lefèvre",
    email: "marc.lefevre@example.org",
    phone: null,
    role: "prospect",
    status: "actif",
    tags: ["prospect"],
    notes: "A demandé des infos sur le coworking.",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "c6666666-6666-4666-8666-666666666666",
    organization_id: BK_ORG_ID,
    name: "Hélène Roy",
    email: "helene.roy@example.org",
    phone: "+33 6 45 67 89 01",
    role: "equipe",
    status: "actif",
    tags: ["coordination"],
    notes: "Coordination du lieu.",
    created_at: NOW,
    updated_at: NOW,
  },
];

export function demoOrgBySlug(slug: string): Organization | undefined {
  return DEMO_ORGANIZATIONS.find((o) => o.slug === slug);
}

export function demoPublicSiteBySlug(slug: string): PublicSite | undefined {
  return DEMO_PUBLIC_SITES.find((s) => s.slug === slug && s.status === "publie");
}

export function demoRequestsForOrg(orgId: string): IncomingRequest[] {
  return DEMO_REQUESTS.filter((r) => r.organization_id === orgId);
}
