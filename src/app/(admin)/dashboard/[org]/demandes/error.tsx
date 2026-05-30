"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Frontière d'erreur du module Demandes (jamais d'écran blanc). */
export default function DemandesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Demandes — erreur de rendu/chargement :", error);
  }, [error]);

  return (
    <div className="mc-card">
      <div className="mc-empty">
        <span className="mc-empty-ic" style={{ background: "#fdeae4", color: "var(--coral-dark)" }}>
          <AlertTriangle className="size-6" strokeWidth={1.8} />
        </span>
        <div className="mc-empty-title">Impossible de charger les demandes</div>
        <p className="mc-empty-sub">
          Une erreur est survenue. Vérifiez votre connexion puis réessayez.
        </p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={reset}>
          <RotateCcw className="size-3.5" /> Réessayer
        </button>
      </div>
    </div>
  );
}
