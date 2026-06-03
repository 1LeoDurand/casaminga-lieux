import { getAllHelpArticles, getAllHelpCategories } from "@/lib/admin/data";
import { HelpEditor } from "@/components/admin/help-editor";

export const dynamic = "force-dynamic";

export default async function AdminHelpPage() {
  const [articles, categories] = await Promise.all([
    getAllHelpArticles(),
    getAllHelpCategories(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Centre d'aide</h1>
        <p className="mt-1 text-sm text-warmgray">
          Contenu commun à tous les lieux. Édition autonome — publié immédiatement sur{" "}
          <a href="/aide" target="_blank" rel="noreferrer" className="font-semibold text-coral-dark hover:underline">/aide</a>.
        </p>
      </header>
      <HelpEditor articles={articles} categories={categories} />
    </div>
  );
}
