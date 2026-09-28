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

// Le contexte de plateforme n'est encore que lu (titre d'onglet, ci-dessus) :
// le filtre des cartes par plateforme est le prompt 6, pas celui-ci.
export default async function AdminRoadmapPage() {
  const tasks = await getRoadmapTasks();

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Feuille de route</h1>
        <p className="mt-1 text-sm text-warmgray">
          Vue d&apos;ensemble du chantier Casa Minga. Une carte déposée dans
          <span className="font-medium text-amber-700"> Validé</span> vaut feu vert ;
          <span className="font-medium text-violet-700"> À déployer</span> signale ce qui est
          codé mais pas encore en production.
        </p>
      </header>

      <RoadmapBoard tasks={tasks} />
    </div>
  );
}
