/**
 * Chargement commun des pages dédiées du site public
 * (/site/[slug]/a-propos, /agenda, /espaces, /soutenir).
 */
import "server-only";
import { getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";
import { getPublishedSiteContent } from "@/lib/site-public/data";
import { mergeSiteContent, type SiteContent } from "@/lib/site-public/types";
import { getEstablishmentForPublic } from "@/lib/establishments";
import type { Organization, Establishment } from "@/lib/types";

export interface PublicSitePageData {
  org: Organization;
  establishment: Establishment | null;
  displayName: string;
  content: SiteContent;
}

/** Résout org/établissement + contenu publié. Retourne null si le site n'existe pas. */
export async function loadPublicSite(slug: string): Promise<PublicSitePageData | null> {
  let org = await getOrganizationBySlug(slug);
  let establishment: Establishment | null = null;
  if (!org) {
    const est = await getEstablishmentForPublic(slug);
    if (est) {
      establishment = est.establishment;
      org = await getOrganizationBySlug(est.orgSlug);
    }
  }
  if (!org) return null;

  const site = await getPublicSiteBySlug(org.slug);
  if (!site) return null;

  const raw = await getPublishedSiteContent(org.id);
  return {
    org,
    establishment,
    displayName: establishment?.name ?? org.name,
    content: mergeSiteContent(raw),
  };
}
