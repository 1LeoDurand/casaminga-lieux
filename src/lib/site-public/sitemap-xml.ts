/**
 * Construction et sérialisation d'un sitemap — fonctions pures.
 *
 * Séparé de `sitemap-data.ts` (qui, lui, lit la base) pour rester testable
 * hors Next : c'est ici que se trouvent les règles qui méritent des tests.
 */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

export interface SitePages {
  updatedAt: string | null;
  pages: { apropos: boolean; agenda: boolean; espaces: boolean; soutenir: boolean };
}

/**
 * Pages d'un site, dans l'ordre où elles comptent pour le référencement.
 *
 * `base` est la racine du site, sans barre finale : `https://casaminga.com/mon-lieu`
 * sur le domaine partagé, `https://monlieu.fr` sur un domaine personnalisé.
 * C'est à l'appelant de la construire — lui seul sait sur quel host il répond.
 */
export function siteEntries(
  base: string,
  site: SitePages,
  events: { id: string; updatedAt: string | null }[] = []
): SitemapEntry[] {
  const lastmod = site.updatedAt ?? undefined;
  const entries: SitemapEntry[] = [
    { loc: base, lastmod, changefreq: "weekly", priority: 1.0 },
  ];
  if (site.pages.apropos) entries.push({ loc: `${base}/a-propos`, lastmod, changefreq: "monthly", priority: 0.7 });
  if (site.pages.agenda) entries.push({ loc: `${base}/agenda`, lastmod, changefreq: "daily", priority: 0.8 });
  if (site.pages.espaces) entries.push({ loc: `${base}/espaces`, lastmod, changefreq: "monthly", priority: 0.7 });
  if (site.pages.soutenir) entries.push({ loc: `${base}/soutenir`, lastmod, changefreq: "monthly", priority: 0.6 });
  for (const e of events) {
    entries.push({
      loc: `${base}/agenda/${e.id}`,
      lastmod: e.updatedAt ?? undefined,
      changefreq: "weekly",
      priority: 0.6,
    });
  }
  return entries;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemap(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) {
        const d = new Date(e.lastmod);
        if (!isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
      }
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  // Une heure : assez pour absorber les passages de robots, assez court pour
  // qu'un site publié aujourd'hui soit soumis aujourd'hui.
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};
