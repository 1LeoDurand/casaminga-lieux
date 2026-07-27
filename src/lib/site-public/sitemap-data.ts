/**
 * Données et sérialisation des sitemaps du domaine public.
 *
 * Pourquoi ces routes vivent sous /site plutôt qu'à la racine : le proxy
 * réécrit `casaminga.com/<chemin>` vers `/site/<chemin>`. Sans route dédiée,
 * `casaminga.com/sitemap.xml` était donc interprété comme le site du lieu dont
 * le slug serait « sitemap.xml », et répondait 404 — le domaine public n'avait
 * ni sitemap ni robots.txt, alors que c'est lui que les moteurs visitent.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mergeSiteContent } from "./types";

export interface PublishedSite {
  slug: string;
  orgId: string;
  updatedAt: string | null;
  pages: { apropos: boolean; agenda: boolean; espaces: boolean; soutenir: boolean };
}

/** Sites effectivement en ligne. Un brouillon ne doit jamais être soumis. */
export async function getPublishedSites(): Promise<PublishedSite[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("slug, organization_id, updated_at, content_blocks, status")
    .eq("status", "publie");

  return (data ?? []).map((row) => {
    const content = mergeSiteContent((row as { content_blocks: unknown }).content_blocks);
    return {
      slug: (row as { slug: string }).slug,
      orgId: (row as { organization_id: string }).organization_id,
      updatedAt: (row as { updated_at: string | null }).updated_at ?? null,
      pages: content.pages,
    };
  });
}

/**
 * Événements à venir d'une liste d'organisations.
 * Seuls les événements futurs : soumettre une page d'événement passé fait
 * atterrir un visiteur sur une date révolue, ce qui dessert le lieu.
 */
export async function getUpcomingEventIds(
  orgIds: string[]
): Promise<Record<string, { id: string; updatedAt: string | null }[]>> {
  const out: Record<string, { id: string; updatedAt: string | null }[]> = {};
  if (!isSupabaseConfigured() || orgIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("evenements")
    .select("id, organization_id, updated_at, start_at, status")
    .in("organization_id", orgIds)
    // Le même filtre que l'agenda public : la RLS est plus large (elle laisse
    // passer « confirme » et « planifie »), mais ces événements-là ne sont pas
    // affichés. Soumettre une URL que le site n'affiche pas serait une erreur.
    .eq("status", "publie")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  for (const row of (data ?? []) as {
    id: string;
    organization_id: string;
    updated_at: string | null;
  }[]) {
    (out[row.organization_id] ??= []).push({ id: row.id, updatedAt: row.updated_at });
  }
  return out;
}

export { siteEntries, renderSitemap, XML_HEADERS } from "./sitemap-xml";
export type { SitemapEntry } from "./sitemap-xml";
