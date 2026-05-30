"use client";

import { useEffect } from "react";

/**
 * Dialogue de confirmation réutilisable (primitive v1.4).
 * Centré, fond flouté, fermeture par Échap / clic sur l'overlay.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="mc-confirm-ov" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="mc-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-warmgray">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            className="mc-btn mc-btn-outline mc-btn-sm"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-sm"
            onClick={onConfirm}
            disabled={busy}
            style={
              tone === "danger"
                ? { background: "var(--coral-dark)", color: "#fff" }
                : { background: "var(--coral)", color: "#fff" }
            }
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
