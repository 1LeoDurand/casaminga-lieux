import type { Metadata } from "next";

/**
 * Pages publiques du lien signé. Le jeton est dans le chemin : ni indexation,
 * ni en-tête Referer vers les sites tiers (la page photos affiche des liens
 * externes). Les mêmes en-têtes sont posés par src/proxy.ts sur la réponse.
 */
export const metadata: Metadata = {
  title: "Casa Minga",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
