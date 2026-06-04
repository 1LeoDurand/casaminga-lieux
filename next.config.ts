import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Mode standalone ────────────────────────────────────────────────────────
  // Produit un bundle minimal (pas de node_modules inutiles chargés au start).
  // Réduit la RAM au démarrage de ~30-40% sur hébergement contraint.
  output: "standalone",

  // ── Optimisation des imports (tree-shaking à la compilation) ──────────────
  // Évite de charger tout lucide-react ou radix-ui en mémoire côté serveur.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },

  // ── Images ─────────────────────────────────────────────────────────────────
  // On sert déjà des WebP optimisés manuellement via Sharp.
  // Next Image ne fait pas de re-encode inutile + supporte les formats modernes.
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
  },

  // ── Sécurité / perf mineurs ────────────────────────────────────────────────
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
