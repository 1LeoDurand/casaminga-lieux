import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mergeSiteContent, type SitePublicConfig, type SiteContent } from "./types";

/** Config complète du site pour l'éditeur (toutes statuts confondus). */
export async function getSiteConfig(orgId: string, slug: string, orgName: string): Promise<SitePublicConfig> {
  if (!isSupabaseConfigured()) {
    return {
      organization_id: orgId, slug, title: orgName, status: "brouillon",
      seo_description: null, content: mergeSiteContent(null),
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("organization_id, slug, title, status, seo_description, content_blocks")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!data) {
    return {
      organization_id: orgId, slug, title: orgName, status: "brouillon",
      seo_description: null, content: mergeSiteContent(null),
    };
  }
  return {
    organization_id: data.organization_id,
    slug: data.slug,
    title: data.title ?? orgName,
    status: (data.status as "brouillon" | "publie") ?? "brouillon",
    seo_description: data.seo_description,
    content: mergeSiteContent(data.content_blocks),
  };
}

/** Contenu public (uniquement si publié) — pour la vitrine /site/[slug]. */
export async function getPublishedSiteContent(orgId: string): Promise<SiteContent | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("content_blocks, status")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return mergeSiteContent(data.content_blocks);
}
