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
          Tickets remontés depuis le widget, tous lieux confondus. Le triage suggéré suit tes règles :
          <span className="font-medium text-emerald-700"> auto</span> pour les bugs/fautes,
          <span className="font-medium text-amber-700"> ton accord</span> pour le contenu,
          <span className="font-medium text-slate-500"> ignoré</span> pour le hors-périmètre.
        </p>
      </header>

      <FeedbackList items={items} />
    </div>
  );
}
