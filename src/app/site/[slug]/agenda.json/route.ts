import { getEvenementsForOrg } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { eventTypeLabel, isFuture } from "@/lib/events-meta";

/**
 * Flux JSON public des événements à venir d'un lieu.
 *
 *   GET /site/<slug>/agenda.json
 *
 * Pour des intégrations sur-mesure (afficher l'agenda dans une app, un thème
 * de site custom, un tableau…). Read-only, public, CORS ouvert. Même périmètre
 * et même garde que la page Agenda publique et le flux iCal.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);

  if (!data || !data.content.pages.agenda) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { org, establishment, displayName } = data;
  const origin = new URL(request.url).origin;

  const eventsRaw = await getEvenementsForOrg(org.id);
  const events = eventsRaw
    .filter((e) => e.status === "publie" && isFuture(e.start_at) && e.show_on_public_site)
    .filter((e) => !establishment || e.establishment_id === establishment.id)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      type_label: eventTypeLabel(e.type),
      start_at: e.start_at,
      end_at: e.end_at,
      price: e.price,
      free: e.price === 0 || e.price === null,
      description: e.description,
      image: e.photos?.[0] ?? null,
      url: `${origin}/site/${org.slug}/agenda/${e.id}`,
    }));

  return Response.json(
    { organization: { slug: org.slug, name: displayName }, count: events.length, events },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    }
  );
}
