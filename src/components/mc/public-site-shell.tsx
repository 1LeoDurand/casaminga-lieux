/**
 * Shell du site public : navigation + footer, rendus selon le thème.
 * Server component — utilisé par la page d'accueil et les pages dédiées.
 */
import Link from "next/link";
import type { SiteContent } from "@/lib/site-public/types";
import { getTheme } from "@/lib/site-public/themes";

export interface SiteNavLink {
  href: string;
  label: string;
}

/** Construit la navigation : pages dédiées actives + ancres de la page d'accueil. */
export function buildNav(slug: string, c: SiteContent, opts?: { hasCampaigns?: boolean }): SiteNavLink[] {
  const base = `/site/${slug}`;
  const links: SiteNavLink[] = [];
  if (c.pages.apropos) links.push({ href: `${base}/a-propos`, label: "À propos" });
  else if (c.sections.lieu) links.push({ href: `${base}#lieu`, label: "Le lieu" });
  if (c.pages.agenda) links.push({ href: `${base}/agenda`, label: "Agenda" });
  else if (c.sections.agenda) links.push({ href: `${base}#agenda`, label: "Agenda" });
  if (c.pages.espaces) links.push({ href: `${base}/espaces`, label: "Espaces" });
  if (c.pages.soutenir) links.push({ href: `${base}/soutenir`, label: "Soutenir" });
  else if (c.sections.adherer && (opts?.hasCampaigns ?? true)) links.push({ href: `${base}#adherer`, label: "Adhérer" });
  if (c.sections.contact) links.push({ href: `${base}#contact`, label: "Contact" });
  return links;
}

export function PublicSiteShell({
  slug,
  displayName,
  content,
  nav,
  children,
}: {
  slug: string;
  displayName: string;
  content: SiteContent;
  nav: SiteNavLink[];
  children: React.ReactNode;
}) {
  const t = getTheme(content.theme);
  const accent = content.accent_color || t.preview.accent;

  return (
    <main className={`min-h-screen ${t.classes.page}`}>
      {/* Nav */}
      <header className={`sticky top-0 z-30 ${t.classes.nav}`}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Link href={`/site/${slug}`} className={`min-w-0 truncate text-lg font-extrabold ${t.classes.heading}`}>
            {displayName}
          </Link>
          <nav className="ml-auto flex shrink-0 items-center gap-4 text-sm">
            {nav.map((l, i) => {
              const isCta = l.label === "Soutenir" || l.label === "Adhérer";
              return (
                <Link
                  key={`${l.href}-${i}`}
                  href={l.href}
                  className={isCta ? "font-semibold" : t.classes.navLink}
                  style={isCta ? { color: accent } : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/espace"
              className={`hidden rounded-full border px-3 py-1 text-xs font-semibold sm:inline-flex ${
                t.dark ? "border-white/20 text-white/70 hover:border-white/50" : "border-current/20 opacity-70 hover:opacity-100"
              }`}
            >
              Mon espace
            </Link>
          </nav>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className={t.classes.footer}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center text-sm">
          <span>
            Site généré avec <span className="font-semibold">Casa Minga Lieux</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
