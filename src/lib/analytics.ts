/**
 * Helper d'événements GA4 (côté client uniquement).
 *
 * `window.gtag` n'existe QUE si l'utilisateur a accepté les cookies et que
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` est défini (cf. components/analytics/google-analytics.tsx).
 * Si le consentement n'est pas donné, `gtag` est absent → `trackEvent` ne fait rien.
 * C'est donc RGPD-safe : aucun envoi sans consentement.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Envoie un événement de conversion à GA4 (no-op si GA non chargé / pas de consentement). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}
