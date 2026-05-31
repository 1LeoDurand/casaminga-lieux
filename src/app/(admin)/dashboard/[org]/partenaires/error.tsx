"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
export default function PartenairesError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mc-card"><div className="mc-empty"><span className="mc-empty-ic" style={{ background: "#fdeae4", color: "var(--coral-dark)" }}><AlertTriangle className="size-6" strokeWidth={1.8} /></span><div className="mc-empty-title">Erreur partenaires</div><button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={reset}><RotateCcw className="size-3.5" /> Réessayer</button></div></div>;
}
