"use client";

import { usePathname } from "next/navigation";
import { FeedbackWidget } from "@/components/mc/feedback-widget";

/**
 * Monte le FeedbackWidget (signalement de bug) sur tout le site Casa Minga,
 * SAUF :
 *  - l'accueil "/" (landing immersive — pas de widget)
 *  - le dashboard "/dashboard/*" (il a déjà sa propre instance)
 *  - les sites publics générés des lieux "/site/*" (ce ne sont pas nos pages)
 *  - les liens signés "/contact/*" (jeton dans l'URL)
 */
export function GlobalFeedback() {
  const pathname = usePathname();

  if (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/site/") ||
    // Liens signés : le jeton est dans l'URL, le widget la joindrait au signalement.
    pathname.startsWith("/contact/")
  ) {
    return null;
  }

  return <FeedbackWidget />;
}
