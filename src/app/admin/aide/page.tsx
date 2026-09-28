import type { Metadata } from "next";
import { getAllHelpArticles, getAllHelpCategories } from "@/lib/admin/data";
import { HelpEditor } from "@/components/admin/help-editor";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { getAdminPlatformMeta } from "@/lib/admin/platforms";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ plateforme?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const platform = await getAdminPlatform(await searchParams);
  return { title: `${getAdminPlatformMeta(platform).label} · Centre d'aide` };
}

// Audience de chaque plateforme : "admin" pour Admin (particuliers de l'admin,
// à venir), "public" pour Portail (casaminga.com, les associations).
// Séjours n'a pas encore d'audience dans la contrainte CHECK (migration
// 0015_platform) : pas de centre d'aide pour l'instant, un message le dit.
function audienceFor(platform: Awaited<ReturnType<typeof getAdminPlatform>>): "admin" | "public" | undefined {
  if (platform === "admin") return "admin";
  if (platform === "public") return "public";
  return undefined; // "sejour" (message dédié) et "all" (tout, audience affichée)
}

export default async function AdminHelpPage({ searchParams }: PageProps) {
  const platform = await getAdminPlatform(await searchParams);

  if (platform === "sejour") {
    return (
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-extrabold text-ink">Centre d'aide</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Pas encore de centre d'aide pour Séjours.
        </div>
      </div>
    );
  }

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
      <HelpEditor articles={articles} categories={categories} defaultAudience={audience === "public" ? "public" : "admin"} showAudience={platform === "all"} />
    </div>
  );
}
