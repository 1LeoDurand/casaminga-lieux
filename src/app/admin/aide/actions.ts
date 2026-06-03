"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { HELP_CATEGORIES, HELP_ARTICLES } from "@/lib/help-content";

type Result = { ok: boolean; error?: string; summary?: string };

/** Importe le contenu par défaut (help-content.ts) dans les tables Supabase. */
export async function seedDefaultHelp(): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };

  const cats = HELP_CATEGORIES.map((c, i) => ({
    slug: c.slug, label: c.label, icon: c.icon, description: c.description, sort_order: i,
  }));
  const { error: cErr } = await admin.from("help_categories").upsert(cats, { onConflict: "slug" });
  if (cErr) return { ok: false, error: cErr.message };

  const arts = HELP_ARTICLES.map((a, i) => ({
    slug: a.slug, category_slug: a.categorySlug, title: a.title, excerpt: a.excerpt,
    keywords: a.keywords, body: a.body, published: true, sort_order: i,
    updated_at: new Date(a.updatedAt).toISOString(),
  }));
  const { error: aErr } = await admin.from("help_articles").upsert(arts, { onConflict: "slug" });
  if (aErr) return { ok: false, error: aErr.message };

  revalidatePath("/admin/aide");
  revalidatePath("/aide");
  return { ok: true, summary: `${cats.length} catégories et ${arts.length} articles importés.` };
}

export interface ArticleInput {
  slug: string;
  category_slug: string;
  title: string;
  excerpt: string;
  keywords: string[];
  body: string;
  published: boolean;
}

export async function saveHelpArticle(input: ArticleInput, originalSlug?: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  if (!input.slug.trim() || !input.title.trim()) return { ok: false, error: "Slug et titre requis." };

  const payload = { ...input, slug: input.slug.trim(), updated_at: new Date().toISOString() };

  // Renommage de slug : suppression de l'ancien
  if (originalSlug && originalSlug !== payload.slug) {
    await admin.from("help_articles").delete().eq("slug", originalSlug);
  }
  const { error } = await admin.from("help_articles").upsert(payload, { onConflict: "slug" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/aide");
  revalidatePath("/aide");
  revalidatePath(`/aide/${payload.slug}`);
  return { ok: true };
}

export async function deleteHelpArticle(slug: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  const { error } = await admin.from("help_articles").delete().eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/aide");
  revalidatePath("/aide");
  return { ok: true };
}
