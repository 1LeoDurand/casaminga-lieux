import type { Metadata } from "next";
import { getAllHelpArticles, getAllHelpCategories } from "@/lib/admin/data";
import { HelpEditor } from "@/components/admin/help-editor";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { getAdminPlatformMeta } from "@/lib/admin/platforms";
import type { HelpAudience } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ plateforme?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const platform = await getAdminPlatform(await searchParams);
  return { title: `${getAdminPlatformMeta(platform).label} · Centre d'aide` };
}

// Audience de chaque plateforme : "admin" pour Admin (particuliers de l'admin,
// à venir), "public" pour Portail (casaminga.com, les associations), "sejour"
// pour Séjours (sejour.casaminga.com, migration 0023).
function audienceFor(platform: Awaited<ReturnType<typeof getAdminPlatform>>): HelpAudience | undefined {
  if (platform === "admin") return "admin";
  if (platform === "public") return "public";
  if (platform === "sejour") return "sejour";
  return undefined; // "all" (tout, audience affichée)
}

export default async function AdminHelpPage({ searchParams }: PageProps) {
  const platform = await getAdminPlatform(await searchParams);

  const audience = audienceFor(platform);
  const [articles, categories] = await Promise.all([
    getAllHelpArticles(audience),
    getAllHelpCategories(audience),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Centre d'aide</h1>
        <p className="mt-1 text-sm text-warmgray">
          {platform === "all"
            ? "Tous les articles, toutes audiences confondues."
            : `Articles de l'audience ${getAdminPlatformMeta(platform).label}.`}
          {" "}Édition autonome — publié immédiatement sur{" "}
          <a href="/aide" target="_blank" rel="noreferrer" className="font-semibold text-coral-dark hover:underline">/aide</a>.
        </p>
      </header>
      <HelpEditor articles={articles} categories={categories} defaultAudience={audience ?? "admin"} showAudience={platform === "all"} />
    </div>
  );
}
