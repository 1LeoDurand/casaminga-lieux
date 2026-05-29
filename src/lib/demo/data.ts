import type { IncomingRequest, Organization, PublicSite } from "@/lib/types";

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

export function demoOrgBySlug(slug: string): Organization | undefined {
  return DEMO_ORGANIZATIONS.find((o) => o.slug === slug);
}

export function demoPublicSiteBySlug(slug: string): PublicSite | undefined {
  return DEMO_PUBLIC_SITES.find((s) => s.slug === slug && s.status === "publie");
}

export function demoRequestsForOrg(orgId: string): IncomingRequest[] {
  return DEMO_REQUESTS.filter((r) => r.organization_id === orgId);
}
