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

/**
 * Canonical d'une page vitrine servie sous admin.casaminga.com/site/<slug>.
 *
 * Le site public (dépôt casa-minga-public) affiche lui-même les vitrines
 * d'organisation sous casaminga.com/<slug>, avec ses propres chemins :
 * c'est cette adresse qu'on désigne à Google, pour qu'il range la page sous
 * casaminga.com et non sous le sous-domaine technique. Les pages admin restent
 * en ligne, parce que le site public renvoie vers elles pour le formulaire de
 * contact, le don et l'adhésion.
 *
 * `publicPath` : chemin de la page équivalente côté public ("" pour l'accueil,
 * "/histoire" pour /a-propos…). `null` quand le site public n'en a pas.
 * Les vitrines d'établissement n'existent que sur l'admin : canonical admin.
 */
export function vitrineCanonical(
  slug: string,
  adminPath: string,
  publicPath: string | null,
  isEstablishment = false
): string {
  if (publicPath === null || isEstablishment) {
    return `https://admin.casaminga.com/site/${slug}${adminPath}`;
  }
  return `${publicSiteUrl(slug)}${publicPath}`;
}

/** Canonical d'une fiche événement : casaminga.com/evenement/<id>. */
export function publicEventUrl(id: string): string {
  return `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/evenement/${id}`;
}
