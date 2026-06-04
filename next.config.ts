import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
  },

  // ── Sécurité / perf mineurs ────────────────────────────────────────────────
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
