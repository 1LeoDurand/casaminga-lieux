"use client";

import { usePathname } from "next/navigation";
import { FeedbackWidget } from "@/components/mc/feedback-widget";

/**
 * Monte le FeedbackWidget (signalement de bug) sur tout le site Casa Minga,
 * SAUF :
 *  - l'accueil "/" (landing immersive — pas de widget)
 *  - le dashboard "/dashboard/*" (il a déjà sa propre instance)
 *  - les sites publics générés des lieux "/site/*" (ce ne sont pas nos pages)
 */
export function GlobalFeedback() {
  const pathname = usePathname();

  if (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/site/")
  ) {
    return null;
  }

  return <FeedbackWidget />;
}
