"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getStoredConsent, type CookieConsent } from "@/components/mc/cookie-banner";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Charge Google Analytics uniquement si le consentement est "accepted".
 * Réagit en temps réel à l'événement "cookie-consent-update" émis par CookieBanner.
 */
export function GoogleAnalytics() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    // Lecture initiale depuis localStorage
    setConsent(getStoredConsent());

    // Écoute les changements en temps réel (accept / refuse depuis le bandeau)
    function handleUpdate(e: Event) {
      const detail = (e as CustomEvent<CookieConsent>).detail;
      setConsent(detail);
    }
    window.addEventListener("cookie-consent-update", handleUpdate);
    return () => window.removeEventListener("cookie-consent-update", handleUpdate);
  }, []);

  // Pas de GA_ID configuré → rien du tout
  if (!GA_ID) return null;

  // Consentement refusé ou pas encore donné → rien du tout
  if (consent !== "accepted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure'
          });
        `}
      </Script>
    </>
  );
}
