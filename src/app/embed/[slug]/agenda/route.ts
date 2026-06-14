import { getEvenementsForOrg } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { eventTypeLabel, eventRange, isFuture } from "@/lib/events-meta";

/**
 * Widget d'agenda embarquable (iframe) — « intégrer ses événements sur un
 * autre site » (WordPress, Wix, site perso…).
 *
 *   <iframe src="https://admin.casaminga.com/embed/<slug>/agenda"
 *           style="width:100%;border:0" height="600"></iframe>
 *
 * Route handler HTML autonome (pas de layout racine → pas de bandeau cookies
 * ni Toaster dans l'iframe). Read-only, public, mêmes événements que la page
 * Agenda publique (publiés + « afficher sur le site public »). Les liens
 * ouvrent le site dans un nouvel onglet.
 */

export const dynamic = "force-dynamic";

/** Échappement HTML (anti-XSS dans le widget). */
function h(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);

  if (!data || !data.content.pages.agenda) {
    return new Response("Not found", { status: 404 });
  }

  const { org, establishment, displayName, content: c } = data;
  const accent = c.accent_color || getTheme(c.theme).preview.accent;
  const origin = new URL(request.url).origin;

  const eventsRaw = await getEvenementsForOrg(org.id);
  const events = eventsRaw
    .filter((e) => e.status === "publie" && isFuture(e.start_at) && e.show_on_public_site)
    .filter((e) => !establishment || e.establishment_id === establishment.id)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 24);

  const cards = events
    .map((e) => {
      const url = `${origin}/site/${org.slug}/agenda/${e.id}`;
      const price = e.price === 0 || e.price === null ? "Entrée libre" : `${e.price} €`;
      return `
      <a class="cm-ev" href="${h(url)}" target="_blank" rel="noopener noreferrer">
        <span class="cm-type">${h(eventTypeLabel(e.type))}</span>
        <span class="cm-title">${h(e.title)}</span>
        <span class="cm-date">${h(eventRange(e.start_at, e.end_at))}</span>
        <span class="cm-price">${h(price)} →</span>
      </a>`;
    })
    .join("");

  const inner = events.length
    ? `<div class="cm-grid">${cards}</div>`
    : `<div class="cm-empty">Pas d'événement prévu pour l'instant — revenez bientôt&nbsp;!</div>`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agenda — ${h(displayName)}</title>
<style>
  :root { --accent: ${h(accent)}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #2C2C2C; padding: 8px;
  }
  .cm-grid {
    display: grid; gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
  }
  .cm-ev {
    display: flex; flex-direction: column; gap: 6px;
    padding: 14px 16px; border: 1px solid #E5DDD6; border-radius: 14px;
    background: #fff; text-decoration: none; color: inherit;
    transition: box-shadow .15s, transform .15s; min-width: 0;
  }
  .cm-ev:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-1px); }
  .cm-type {
    align-self: flex-start; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em;
    padding: 2px 8px; border-radius: 100px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
  }
  .cm-title { font-size: 14.5px; font-weight: 700; line-height: 1.3; }
  .cm-date { font-size: 12.5px; color: #6B6460; }
  .cm-price { font-size: 12px; font-weight: 600; color: var(--accent); }
  .cm-empty {
    padding: 32px 16px; text-align: center; font-size: 13.5px; color: #6B6460;
    border: 1px dashed #E5DDD6; border-radius: 14px; background: #fff;
  }
  .cm-foot { margin-top: 12px; text-align: right; font-size: 10.5px; }
  .cm-foot a { color: #9C9590; text-decoration: none; }
</style>
</head>
<body>
  ${inner}
  <div class="cm-foot"><a href="${h(`${origin}/site/${org.slug}/agenda`)}" target="_blank" rel="noopener noreferrer">Agenda propulsé par Casa Minga</a></div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Autorise explicitement l'embarquement sur n'importe quel site.
      "Content-Security-Policy": "frame-ancestors *",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
