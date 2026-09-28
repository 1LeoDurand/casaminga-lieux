import type { Metadata } from "next";
import { getRoadmapTasks } from "@/lib/admin/roadmap";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { getAdminPlatformMeta } from "@/lib/admin/platforms";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ plateforme?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const platform = await getAdminPlatform(await searchParams);
  return { title: `${getAdminPlatformMeta(platform).label} · Feuille de route` };
}

export default async function AdminRoadmapPage({ searchParams }: PageProps) {
  const platform = await getAdminPlatform(await searchParams);
  const tasks = await getRoadmapTasks(platform === "all" ? undefined : platform);
  // "Toutes les plateformes" n'a pas de plateforme naturelle à préremplir :
  // "admin" par défaut, comme demandé.
  const defaultPlatform = platform === "all" ? "admin" : platform;

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Feuille de route</h1>
        <p className="mt-1 text-sm text-warmgray">
          {platform === "all"
            ? "Vue d'ensemble, toutes plateformes confondues."
            : `Vue d'ensemble pour ${getAdminPlatformMeta(platform).label}.`}
          {" "}Une carte déposée dans
          <span className="font-medium text-amber-700"> Validé</span> vaut feu vert ;
          <span className="font-medium text-violet-700"> À déployer</span> signale ce qui est
          codé mais pas encore en production.
        </p>
      </header>

      <RoadmapBoard tasks={tasks} defaultPlatform={defaultPlatform} showPlatform={platform === "all"} />
    </div>
  );
}
