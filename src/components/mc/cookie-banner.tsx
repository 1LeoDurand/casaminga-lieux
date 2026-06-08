"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookie_consent";
export type CookieConsent = "accepted" | "refused";

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(CONSENT_KEY) as CookieConsent) ?? null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Affiche le bandeau seulement si aucun choix stocké
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    // Déclenche le chargement de GA sans reload
    window.dispatchEvent(new CustomEvent("cookie-consent-update", { detail: "accepted" }));
  }

  function refuse() {
    localStorage.setItem(CONSENT_KEY, "refused");
    setVisible(false);
    window.dispatchEvent(new CustomEvent("cookie-consent-update", { detail: "refused" }));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "min(560px, calc(100vw - 32px))",
        background: "#FFFBF0",
        border: "1px solid rgba(232, 113, 77, 0.3)",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(44, 44, 44, 0.14), 0 2px 8px rgba(232, 113, 77, 0.08)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Texte */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🍪</span>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#2C2C2C", lineHeight: 1.4, marginBottom: 4 }}>
            On utilise des cookies
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: "#6B6460", lineHeight: 1.6 }}>
            Nous utilisons Google Analytics pour mesurer l'audience et améliorer la plateforme.{" "}
            <Link
              href="/confidentialite"
              style={{ color: "#E8714D", textDecoration: "underline", fontWeight: 500 }}
            >
              En savoir plus
            </Link>
          </p>
        </div>
      </div>

      {/* Boutons */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={refuse}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#6B6460",
            background: "transparent",
            border: "1px solid #D5CFC9",
            borderRadius: 8,
            padding: "7px 16px",
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#9C9590")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#D5CFC9")}
        >
          Refuser
        </button>
        <button
          onClick={accept}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            background: "#E8714D",
            border: "none",
            borderRadius: 8,
            padding: "7px 20px",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#D4613F")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#E8714D")}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
