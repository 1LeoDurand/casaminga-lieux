/**
 * Chargement commun des pages dédiées du site public
 * (/site/[slug]/a-propos, /agenda, /espaces, /soutenir).
 */
import "server-only";
import { headers } from "next/headers";
import { getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";
import { getPublishedSiteContent } from "@/lib/site-public/data";
import { mergeSiteContent, type SiteContent } from "@/lib/site-public/types";
import { getEstablishmentForPublic } from "@/lib/establishments";
import type { Organization, Establishment } from "@/lib/types";

const APEX_HOSTS = ["casaminga.com", "www.casaminga.com"];

/**
 * Le thème personnalisé est un bénéfice du domaine personnalisé :
 * sur casaminga.com/<slug>, le design reste harmonisé Casa Minga (Chaleureux).
 * Partout ailleurs (domaine perso, admin en aperçu, localhost), thème choisi.
 */
export async function applyHostTheme(c: SiteContent): Promise<SiteContent> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  if (APEX_HOSTS.includes(host)) c.theme = "chaleureux";
  return c;
}

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
    content: await applyHostTheme(mergeSiteContent(raw)),
  };
}
