import type { MetadataRoute } from "next";

/**
 * robots.txt généré (Next.js metadata route → /robots.txt).
 *
 * On autorise l'indexation des pages vitrine/marketing et du centre d'aide,
 * et on bloque tout l'espace privé : dashboard, back-office, API, pages
 * transactionnelles (scan billets, signatures, désinscription…).
 *
 * Les sites vitrines des lieux (/site/<slug>) ne sont PAS indexés ici : leur
 * URL canonique est casaminga.com/<slug> (le proxy réécrit), pour éviter le
 * contenu dupliqué entre les deux domaines.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/login",
          "/signup",
          "/onboarding",
          "/site/",
          "/scan/",
          "/signer/",
          "/tache/",
          "/billet/",
          "/embed/",
          "/espace/",
          "/rejoindre/",
          "/newsletter/",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: "https://admin.casaminga.com/sitemap.xml",
  };
}
