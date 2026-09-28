import type { Metadata } from "next";
import { getAllFeedback } from "@/lib/admin/data";
import { FeedbackList } from "@/components/admin/feedback-list";
import { getAdminPlatform } from "@/lib/admin/platform-context";
import { getAdminPlatformMeta } from "@/lib/admin/platforms";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ plateforme?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const platform = await getAdminPlatform(await searchParams);
  return { title: `${getAdminPlatformMeta(platform).label} · Feedback` };
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  const platform = await getAdminPlatform(await searchParams);
  const items = await getAllFeedback(platform === "all" ? undefined : platform);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Feedback & bugs</h1>
        <p className="mt-1 text-sm text-warmgray">
          Tickets remontés depuis le widget
          {platform === "all" ? ", toutes plateformes confondues." : ` de ${getAdminPlatformMeta(platform).label}.`}
          {" "}
          <span className="font-medium text-emerald-700">Accepter</span> = pris en charge,
          <span className="font-medium text-coral"> Archiver</span> = réalisé,
          <span className="font-medium text-slate-500"> Refuser</span> = suppression définitive.
          Ajoute une note sur chaque ticket pour préciser tes intentions.
        </p>
      </header>

      <FeedbackList items={items} />
    </div>
  );
}
