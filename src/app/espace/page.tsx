import type { Metadata } from "next";
import { EspaceRequestForm } from "@/app/espace/espace-request-form";

export const metadata: Metadata = {
  title: "Espace adhérent — Casa Minga",
  description: "Accédez à votre espace adhérent : statut d'adhésion, billets à venir, renouvellement.",
};

export default function EspacePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFBF0",
        fontFamily: "'Poppins', sans-serif",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo / titre */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              background: "#FF8A65",
              borderRadius: 16,
              marginBottom: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 4a6 6 0 100 12A6 6 0 0014 4zm0 14c-5.33 0-10 2.67-10 4v2h20v-2c0-1.33-4.67-4-10-4z"
                fill="#fff"
              />
            </svg>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#2C2C2C",
              letterSpacing: "-0.5px",
            }}
          >
            Espace adhérent
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#9C9590" }}>
            Accédez à votre dossier en toute simplicité,<br />
            sans compte ni mot de passe.
          </p>
        </div>

        {/* Carte formulaire */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            border: "1px solid #E5DDD6",
            padding: "28px 32px",
            boxShadow: "0 4px 24px rgba(28,28,28,0.06)",
          }}
        >
          <EspaceRequestForm />
        </div>
      </div>
    </main>
  );
}
