import type { MetadataRoute } from "next";

/**
 * sitemap.xml généré (Next.js metadata route → /sitemap.xml).
 *
 * Uniquement les pages publiques indexables d'admin.casaminga.com :
 * vitrine marketing, centre d'aide et pages légales. Le dashboard et le
 * back-office restent hors index (cf. robots.ts).
 */
const BASE = "https://admin.casaminga.com";

type Entry = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
};

const PAGES: Entry[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/approche", priority: 0.8, changeFrequency: "monthly" },
  { path: "/fonctionnement", priority: 0.8, changeFrequency: "monthly" },
  { path: "/histoire", priority: 0.6, changeFrequency: "monthly" },
  { path: "/aide", priority: 0.6, changeFrequency: "weekly" },
  { path: "/cgu", priority: 0.2, changeFrequency: "yearly" },
  { path: "/cgv", priority: 0.2, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.2, changeFrequency: "yearly" },
  { path: "/mentions-legales", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
