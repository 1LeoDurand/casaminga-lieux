import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, ArrowLeft } from "lucide-react";
import {
  getHelpCategory,
  getHelpArticlesByCategory,
} from "@/lib/help-data";
import { HELP_CATEGORIES } from "@/lib/help-content";

// Slugs connus pré-rendus ; les nouvelles catégories ajoutées en base
// sont rendues à la demande (dynamicParams par défaut).
export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getHelpCategory(slug);
  if (!category) return { title: "Catégorie introuvable — Centre d'aide" };
  return {
    title: `${category.label} — Centre d'aide Casa Minga`,
    description: category.description,
  };
}

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getHelpCategory(slug);
  if (!category) notFound();

  const articles = await getHelpArticlesByCategory(slug);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-[13px] text-warmgray">
        <Link href="/aide" className="hover:text-coral-dark">
          Centre d'aide
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{category.label}</span>
      </nav>

      <h1 className="mt-4 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
        {category.label}
      </h1>
      <p className="mt-2 text-[15px] text-warmgray">{category.description}</p>

      {/* Liste des articles */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#E5DDD6] bg-white">
        {articles.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-warmgray">
            Aucun article dans cette catégorie pour le moment.
          </p>
        ) : (
          articles.map((a, i) => (
            <Link
              key={a.slug}
              href={`/aide/${a.slug}`}
              className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-peach-pale ${
                i > 0 ? "border-t border-[#F0E8E0]" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-foreground">
                  {a.title}
                </span>
                <span className="block truncate text-[12.5px] text-warmgray">
                  {a.excerpt}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-warmgray" />
            </Link>
          ))
        )}
      </div>

      <div className="mt-8">
        <Link
          href="/aide"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-warmgray hover:text-coral-dark"
        >
          <ArrowLeft className="size-4" />
          Retour au centre d'aide
        </Link>
      </div>
    </div>
  );
}
