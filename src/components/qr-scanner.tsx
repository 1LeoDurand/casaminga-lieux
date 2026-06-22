"use client";

import { useEffect, useRef, useState } from "react";
import { checkInByTicket, type CheckInResult } from "@/lib/tickets";

interface Feedback extends CheckInResult { at: number }

const STATUS_UI: Record<string, { bg: string; emoji: string; label: string }> = {
  ok:         { bg: "#16a34a", emoji: "✅", label: "Validé — bienvenue !" },
  already:    { bg: "#d97706", emoji: "⚠️", label: "Déjà scanné" },
  invalid:    { bg: "#dc2626", emoji: "❌", label: "Billet inconnu" },
  wrong_event:{ bg: "#dc2626", emoji: "❌", label: "Billet d'un autre événement" },
  cancelled:  { bg: "#dc2626", emoji: "❌", label: "Inscription annulée" },
  unpaid:     { bg: "#dc2626", emoji: "💳", label: "Billet non réglé" },
  error:      { bg: "#dc2626", emoji: "⚠️", label: "Erreur — réessayez" },
};

export function QrScanner({ linkToken, eventTitle }: { linkToken: string; eventTitle: string }) {
  const regionId = "qr-scan-region";
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lockRef = useRef(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  async function handleToken(raw: string) {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const res = await checkInByTicket(linkToken, raw);
      setFeedback({ ...res, at: Date.now() });
      if (res.status === "ok") setCount((c) => c + 1);
      // petit buzz si dispo
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(res.status === "ok" ? 80 : [40, 40, 40]);
      }
    } finally {
      // anti rafale : 1,5 s avant le prochain scan
      setTimeout(() => { lockRef.current = false; }, 1500);
    }
  }

  async function start() {
    setCamError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { void handleToken(decoded); },
        () => { /* pas de QR dans la frame : ignore */ },
      );
      setStarted(true);
    } catch (e) {
      setCamError(e instanceof Error ? e.message : "Accès caméra refusé");
    }
  }

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) { s.stop().then(() => s.clear()).catch(() => {}); }
    };
  }, []);

  const fb = feedback ? STATUS_UI[feedback.status] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", fontFamily: "'Poppins',sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Scan billets</div>
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{eventTitle}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{count}</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>entrées</div>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div id={regionId} style={{ width: "100%", maxWidth: 360, borderRadius: 16, overflow: "hidden", background: "#000" }} />

        {!started && !camError && (
          <button onClick={start} style={{ marginTop: 24, background: "#FF8A65", color: "#fff", border: "none", borderRadius: 100, padding: "14px 32px", fontSize: 16, fontWeight: 700 }}>
            📷 Démarrer le scan
          </button>
        )}
        {camError && (
          <div style={{ marginTop: 20, textAlign: "center", color: "#fca5a5", fontSize: 14, maxWidth: 320 }}>
            Caméra indisponible : {camError}<br />
            <span style={{ color: "#94a3b8", fontSize: 12 }}>Autorisez la caméra et rechargez la page.</span>
          </div>
        )}
      </div>

      {/* Bandeau résultat */}
      {fb && (
        <div style={{ background: fb.bg, padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>{fb.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fb.label}</div>
          {feedback?.fullName && <div style={{ fontSize: 15, marginTop: 2 }}>{feedback.fullName}{feedback.seats && feedback.seats > 1 ? ` · ${feedback.seats} places` : ""}</div>}
          {feedback?.status === "already" && feedback.checkedAt && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>à {new Date(feedback.checkedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
          )}
        </div>
      )}
    </div>
  );
}
