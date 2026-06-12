"use client";

import { useState, useTransition } from "react";
import { cancelTicketAction } from "./actions";

/**
 * Annulation du billet par son porteur — confirmation en deux temps,
 * pas de modal (page publique légère, sans design system).
 */
export function CancelTicketButton({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function doCancel() {
    startTransition(async () => {
      const res = await cancelTicketAction(token);
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div style={{ marginTop: 18, padding: "12px 16px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, fontSize: 13, color: "#92400E", textAlign: "center" }}>
        Votre place a été annulée. Merci d&apos;avoir prévenu — elle profitera à quelqu&apos;un d&apos;autre.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18, textAlign: "center" }}>
      {error && (
        <p style={{ marginBottom: 8, fontSize: 12, color: "#DC2626" }}>{error}</p>
      )}
      {confirming ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            onClick={doCancel}
            disabled={pending}
            style={{ padding: "8px 18px", borderRadius: 100, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Annulation…" : "Oui, annuler ma place"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            style={{ padding: "8px 18px", borderRadius: 100, border: "1px solid #E5DDD6", background: "#fff", color: "#2C2C2C", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Non, je garde mon billet
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{ background: "none", border: "none", fontSize: 12, color: "#9c9590", textDecoration: "underline", cursor: "pointer" }}
        >
          Je ne peux plus venir — annuler ma place
        </button>
      )}
    </div>
  );
}
