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

export type HelpAudience = "admin" | "public";
const HELP_AUDIENCES: HelpAudience[] = ["admin", "public"];

export interface ArticleInput {
  slug: string;
  category_slug: string;
  title: string;
  excerpt: string;
  keywords: string[];
  body: string;
  published: boolean;
  audience: HelpAudience;
}

export async function saveHelpArticle(input: ArticleInput, originalSlug?: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  if (!input.slug.trim() || !input.title.trim()) return { ok: false, error: "Slug et titre requis." };
  if (!HELP_AUDIENCES.includes(input.audience)) return { ok: false, error: "Audience invalide." };

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

export interface CategoryInput {
  slug: string;
  label: string;
  icon: string;
  description: string;
  audience: HelpAudience;
}

export async function saveHelpCategory(input: CategoryInput, originalSlug?: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  if (!input.slug.trim() || !input.label.trim()) return { ok: false, error: "Slug et libellé requis." };
  if (!HELP_AUDIENCES.includes(input.audience)) return { ok: false, error: "Audience invalide." };

  const payload = {
    slug: input.slug.trim(),
    label: input.label.trim(),
    icon: input.icon.trim() || "circle",
    description: input.description.trim() || null,
    audience: input.audience,
  };

  const { error } = await admin.from("help_categories").upsert(payload, { onConflict: "slug" });
  if (error) return { ok: false, error: error.message };

  // Slug rename: the FK is ON DELETE SET NULL, so articles must be moved to the
  // new slug before the old row goes, or they silently lose their category.
  if (originalSlug && originalSlug !== payload.slug) {
    const { error: moveErr } = await admin
      .from("help_articles")
      .update({ category_slug: payload.slug })
      .eq("category_slug", originalSlug);
    if (moveErr) return { ok: false, error: moveErr.message };
    const { error: delErr } = await admin.from("help_categories").delete().eq("slug", originalSlug);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/admin/aide");
  revalidatePath("/aide");
  return { ok: true };
}

export async function deleteHelpCategory(slug: string): Promise<Result> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "service role manquant" };
  // Deleting a non-empty category would orphan its articles (FK is ON DELETE SET NULL).
  const { count, error: countErr } = await admin
    .from("help_articles")
    .select("slug", { count: "exact", head: true })
    .eq("category_slug", slug);
  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cette catégorie contient ${count} article(s) : déplacez-les ou supprimez-les d'abord.`,
    };
  }
  const { error } = await admin.from("help_categories").delete().eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/aide");
  revalidatePath("/aide");
  return { ok: true };
}
