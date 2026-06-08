import { getModerationLieux, getPortalPendingEvents } from "@/lib/admin/data";
import { ModerationView } from "@/components/admin/moderation-view";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const [lieux, events] = await Promise.all([getModerationLieux(), getPortalPendingEvents()]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Modération</h1>
        <p className="mt-1 text-sm text-warmgray">
          Validez la mise en ligne des sites de lieux et choisissez ce qui s&apos;affiche sur le portail public casaminga.com.
        </p>
      </header>

      <ModerationView lieux={lieux} events={events} />
    </div>
  );
}
