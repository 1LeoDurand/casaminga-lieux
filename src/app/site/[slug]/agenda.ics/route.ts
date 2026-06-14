import { getEvenementsForOrg } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { eventTypeLabel } from "@/lib/events-meta";

/**
 * Flux iCal public des événements d'un lieu.
 *
 *   GET /site/<slug>/agenda.ics
 *
 * Permet d'« intégrer ses événements sur un autre site » / un autre agenda :
 * Google Agenda, Outlook, Apple Calendar (abonnement par URL), plugins
 * WordPress qui consomment un .ics, etc. Read-only, public, aucune donnée
 * sensible — mêmes événements que la page Agenda publique (publiés + cochés
 * « afficher sur le site public »).
 */

export const dynamic = "force-dynamic";

/** Échappe une valeur texte selon RFC 5545 (virgule, point-virgule, backslash, retour ligne). */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Date ISO → format iCal UTC : YYYYMMDDTHHMMSSZ. */
function toICalUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Repli des lignes à 75 octets (RFC 5545), continuation par espace. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);

  // Site introuvable / non publié / agenda désactivé → 404 (cohérent avec la page).
  if (!data || !data.content.pages.agenda) {
    return new Response("Not found", { status: 404 });
  }

  const { org, establishment, displayName } = data;
  const origin = new URL(request.url).origin;

  const eventsRaw = await getEvenementsForOrg(org.id);
  const events = eventsRaw
    .filter((e) => e.status === "publie" && e.show_on_public_site)
    .filter((e) => !establishment || e.establishment_id === establishment.id)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const now = toICalUTC(new Date().toISOString());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Casa Minga Lieux//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(`Agenda — ${displayName}`)}`),
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  for (const e of events) {
    const url = `${origin}/site/${org.slug}/agenda/${e.id}`;
    const descParts: string[] = [];
    if (e.description) descParts.push(e.description);
    descParts.push(
      e.price === 0 || e.price === null ? "Entrée libre" : `Tarif : ${e.price} €`
    );
    descParts.push(url);

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.id}@casaminga-lieux`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${toICalUTC(e.start_at)}`);
    if (e.end_at) lines.push(`DTEND:${toICalUTC(e.end_at)}`);
    lines.push(fold(`SUMMARY:${esc(e.title)}`));
    lines.push(fold(`DESCRIPTION:${esc(descParts.join("\n"))}`));
    lines.push(fold(`CATEGORIES:${esc(eventTypeLabel(e.type))}`));
    lines.push(fold(`LOCATION:${esc(establishment?.name ?? displayName)}`));
    lines.push(fold(`URL:${url}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="agenda-${org.slug}.ics"`,
      // Cache court : l'agenda peut bouger, mais on évite de marteler la base.
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
