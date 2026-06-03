import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  HELP_CATEGORIES,
  HELP_ARTICLES,
  type HelpCategory,
  type HelpArticle,
} from "@/lib/help-content";

/**
 * Centre d'aide v2 — source unique de vérité.
 * Si la table `help_articles` contient des lignes → on lit Supabase (édition autonome).
 * Sinon → fallback sur le contenu en dur (`help-content.ts`). Rien ne casse jamais.
 */

async function dbCategories(): Promise<HelpCategory[] | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("help_categories")
    .select("slug, label, icon, description, sort_order")
    .order("sort_order", { ascending: true });
  if (!data || data.length === 0) return null;
  return data.map((c) => ({
    slug: c.slug, label: c.label, icon: c.icon ?? "rocket", description: c.description ?? "",
  }));
}

async function dbArticles(): Promise<HelpArticle[] | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("help_articles")
    .select("slug, category_slug, title, excerpt, keywords, body, updated_at, published, sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  if (!data || data.length === 0) return null;
  return data.map((a) => ({
    slug: a.slug,
    categorySlug: a.category_slug ?? "",
    title: a.title,
    excerpt: a.excerpt ?? "",
    keywords: a.keywords ?? [],
    body: a.body ?? "",
    updatedAt: (a.updated_at ?? new Date().toISOString()).slice(0, 10),
  }));
}

export async function getHelpCategories(): Promise<HelpCategory[]> {
  return (await dbCategories()) ?? HELP_CATEGORIES;
}

export async function getHelpArticles(): Promise<HelpArticle[]> {
  return (await dbArticles()) ?? HELP_ARTICLES;
}

export async function getHelpCategory(slug: string): Promise<HelpCategory | undefined> {
  return (await getHelpCategories()).find((c) => c.slug === slug);
}

export async function getHelpArticle(slug: string): Promise<HelpArticle | undefined> {
  return (await getHelpArticles()).find((a) => a.slug === slug);
}

export async function getHelpArticlesByCategory(categorySlug: string): Promise<HelpArticle[]> {
  return (await getHelpArticles()).filter((a) => a.categorySlug === categorySlug);
}

/** Incrémente le compteur de vues (best-effort, ne bloque pas le rendu). */
export async function incrementHelpView(slug: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("help_increment_view", { p_slug: slug });
  } catch {
    /* non bloquant */
  }
}
