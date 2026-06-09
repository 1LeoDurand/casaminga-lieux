"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestPortalLinkAction } from "@/app/espace/actions";

const initialState = { ok: false };

export function EspaceRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPortalLinkAction,
    initialState
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state.ok]);

  if (state.ok) {
    return (
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 16,
          padding: "24px 28px",
          textAlign: "center",
          color: "#166534",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
          Si un dossier existe pour cette adresse, vous recevrez un lien dans quelques instants.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.75 }}>
          Vérifiez aussi vos spams.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label
          htmlFor="portal-email"
          style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#6B6460", marginBottom: 6 }}
        >
          Votre adresse email
        </label>
        <input
          ref={inputRef}
          id="portal-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="votre@email.com"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #E5DDD6",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 15,
            color: "#2C2C2C",
            background: "#FAFAF7",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          background: "#FF8A65",
          color: "#fff",
          border: "none",
          borderRadius: 100,
          padding: "14px 28px",
          fontSize: 15,
          fontWeight: 700,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
          transition: "opacity 0.2s",
          fontFamily: "inherit",
        }}
      >
        {pending ? "Envoi en cours…" : "Recevoir mon lien d'accès"}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: "#9C9590", textAlign: "center" }}>
        Un email personnel vous sera envoyé si un dossier est associé à cette adresse.
        <br />
        Aucun compte ni mot de passe requis.
      </p>
    </form>
  );
}
