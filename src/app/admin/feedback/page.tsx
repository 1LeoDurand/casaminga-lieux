import { getAllFeedback } from "@/lib/admin/data";
import { FeedbackList } from "@/components/admin/feedback-list";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const items = await getAllFeedback();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Feedback & bugs</h1>
        <p className="mt-1 text-sm text-warmgray">
          Tickets remontés depuis le widget, tous lieux confondus.
          <span className="font-medium text-emerald-700"> Accepter</span> = pris en charge,
          <span className="font-medium text-coral"> Archiver</span> = réalisé,
          <span className="font-medium text-slate-500"> Refuser</span> = suppression définitive.
          Ajoute une note sur chaque ticket pour préciser tes intentions.
        </p>
      </header>

      <FeedbackList items={items} />
    </div>
  );
}
