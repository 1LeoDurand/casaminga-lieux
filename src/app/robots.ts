import type { MetadataRoute } from "next";

/**
 * robots.txt généré (Next.js metadata route → /robots.txt).
 *
 * On autorise l'indexation des pages vitrine/marketing et du centre d'aide,
 * et on bloque tout l'espace privé : dashboard, back-office, API, pages
 * transactionnelles (scan billets, signatures, désinscription…).
 *
 * Les sites vitrines des lieux (/site/<slug>) SONT indexables ici : le
 * domaine canonique casaminga.com est actuellement hors service, donc on
 * assume admin.casaminga.com/site/<slug> comme URL indexable temporaire
 * (voir generateMetadata → alternates.canonical dans src/app/site/[slug]).
 *
 * Les règles disallow ci-dessous n'ont volontairement PAS de slash final :
 * un disallow sans slash final couvre à la fois le chemin exact (ex.
 * "/espace") et tous ses sous-chemins (ex. "/espace/xyz").
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/login",
          "/signup",
          "/onboarding",
          "/scan",
          "/signer",
          "/tache",
          "/billet",
          "/embed",
          "/espace",
          "/rejoindre",
          "/newsletter",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: "https://admin.casaminga.com/sitemap.xml",
  };
}
