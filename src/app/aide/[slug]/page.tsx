import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, ArrowLeft } from "lucide-react";
import {
  getHelpArticle,
  getHelpCategory,
  getHelpArticlesByCategory,
  incrementHelpView,
} from "@/lib/help-data";
import { HELP_ARTICLES } from "@/lib/help-content";
import { renderMarkdown } from "@/lib/help-md";
import { HelpFeedback } from "@/components/help/help-feedback";

// Slugs connus pré-rendus ; les nouveaux articles ajoutés en base
// sont rendus à la demande (dynamicParams par défaut).
export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) return { title: "Article introuvable — Centre d'aide" };
  return {
    title: `${article.title} — Centre d'aide Casa Minga`,
    description: article.excerpt,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) notFound();

  void incrementHelpView(slug);

  const category = await getHelpCategory(article.categorySlug);
  const related = (await getHelpArticlesByCategory(article.categorySlug)).filter(
    (a) => a.slug !== article.slug
  );
  const html = renderMarkdown(article.body);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Fil d'Ariane */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-warmgray">
        <Link href="/aide" className="hover:text-coral-dark">
          Centre d'aide
        </Link>
        {category && (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              href={`/aide/categorie/${category.slug}`}
              className="hover:text-coral-dark"
            >
              {category.label}
            </Link>
          </>
        )}
      </nav>

      {/* Titre */}
      <h1 className="mt-4 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
        {article.title}
      </h1>
      <p className="mt-2 text-[13px] text-warmgray">
        Mis à jour le{" "}
        {new Date(article.updatedAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      {/* Corps */}
      <article
        className="help-prose mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Articles liés */}
      {related.length > 0 && (
        <div className="mt-12 border-t border-[#F0E8E0] pt-8">
          <h2 className="mb-4 font-heading text-base font-bold">
            Articles liés
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/aide/${r.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E5DDD6] bg-white px-4 py-3 transition hover:border-peach hover:bg-peach-pale"
                >
                  <span className="text-sm font-medium">{r.title}</span>
                  <ChevronRight className="size-4 shrink-0 text-warmgray" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cet article a-t-il aidé ? + contact */}
      <HelpFeedback slug={article.slug} />

      {/* Retour */}
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
