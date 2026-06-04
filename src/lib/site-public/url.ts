/**
 * Domaine public des sites vitrines.
 * Le proxy.ts réécrit casaminga.com/<slug> → /site/<slug>,
 * donc l'URL publique propre est : casaminga.com/<slug> (sans /site/).
 *
 * Configurable via NEXT_PUBLIC_PUBLIC_SITE_URL (défaut : https://casaminga.com).
 */
export const PUBLIC_SITE_BASE =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://casaminga.com";

/** URL publique complète d'un site vitrine (à partager). */
export function publicSiteUrl(slug: string): string {
  return `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/${slug}`;
}

/** Version affichable sans le protocole (ex. casaminga.com/bernard-kohn). */
export function publicSiteUrlDisplay(slug: string): string {
  return publicSiteUrl(slug).replace(/^https?:\/\//, "");
}
