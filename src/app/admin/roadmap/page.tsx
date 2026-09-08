import { getRoadmapTasks } from "@/lib/admin/roadmap";
import { RoadmapBoard } from "@/components/admin/roadmap-board";

export const dynamic = "force-dynamic";

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
