"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkInByTicket, getEventTicketManifest, syncCheckIns, type CheckInResult } from "@/lib/tickets";
import {
  loadManifest, localCheckIn, enqueue, getPendingQueue, markSynced,
  manifestCount, pendingCount, type ManifestEntry,
} from "@/lib/offline-scan";

interface Feedback extends CheckInResult { at: number }

const STATUS_UI: Record<string, { bg: string; emoji: string; label: string }> = {
  ok:         { bg: "#16a34a", emoji: "✅", label: "Validé — bienvenue !" },
  already:    { bg: "#d97706", emoji: "⚠️", label: "Déjà scanné" },
  invalid:    { bg: "#dc2626", emoji: "❌", label: "Billet inconnu" },
  wrong_event:{ bg: "#dc2626", emoji: "❌", label: "Billet d'un autre événement" },
  cancelled:  { bg: "#dc2626", emoji: "❌", label: "Inscription annulée" },
  unpaid:     { bg: "#dc2626", emoji: "💳", label: "Billet non réglé" },
  error:      { bg: "#dc2626", emoji: "⚠️", label: "Erreur — réessayez" },
  already_local: { bg: "#d97706", emoji: "⚠️", label: "Déjà scanné (local)" },
};

export function QrScanner({ linkToken, eventTitle }: { linkToken: string; eventTitle: string }) {
  const regionId = "qr-scan-region";
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lockRef = useRef(false);
  const syncingRef = useRef(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [manifestSize, setManifestSize] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);

  // Indicateurs réseau
  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // Rafraîchit le compteur de queue en attente
  const refreshPending = useCallback(async () => {
    setPendingSync(await pendingCount());
  }, []);

  // Charge le manifeste depuis le serveur → IndexedDB
  const fetchManifest = useCallback(async () => {
    if (!isOnline) return;
    setLoadingManifest(true);
    try {
      const manifest = await getEventTicketManifest(linkToken);
      if (manifest) {
        await loadManifest(manifest.tickets as ManifestEntry[]);
        setManifestSize(manifest.tickets.length);
      }
    } catch (e) {
      console.error("[scanner] Erreur chargement manifeste:", e);
    } finally {
      setLoadingManifest(false);
    }
  }, [linkToken, isOnline]);

  // Synchronise la file hors-ligne → serveur
  const drainQueue = useCallback(async () => {
    if (!isOnline || syncingRef.current) return;
    const queue = await getPendingQueue();
    if (queue.length === 0) return;
    syncingRef.current = true;
    try {
      const result = await syncCheckIns(linkToken, queue.map((q) => ({ token: q.token, scannedAt: q.scannedAt })));
      await markSynced(queue.map((q) => q.token));
      await refreshPending();
      const msg = result.conflicts.length > 0
        ? `${result.applied} sync — ${result.conflicts.length} conflit(s)`
        : `${result.applied} billet(s) synchronisé(s)`;
      setSyncMsg(msg);
      setTimeout(() => setSyncMsg(null), 4000);
    } catch (e) {
      console.error("[scanner] Erreur synchro:", e);
    } finally {
      syncingRef.current = false;
    }
  }, [linkToken, isOnline, refreshPending]);

  // Synchro auto quand réseau disponible + toutes les 15 s
  useEffect(() => {
    if (isOnline) { void drainQueue(); }
  }, [isOnline, drainQueue]);

  useEffect(() => {
    const id = setInterval(() => { void drainQueue(); }, 15_000);
    return () => clearInterval(id);
  }, [drainQueue]);

  // Initialise les compteurs au montage
  useEffect(() => {
    void (async () => {
      setManifestSize(await manifestCount());
      await refreshPending();
    })();
  }, [refreshPending]);

  async function handleToken(raw: string) {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const now = new Date().toISOString();
      const clean = raw.trim().split("/").filter(Boolean).pop() ?? raw.trim();

      // Validation locale d'abord (offline-first)
      const localResult = await localCheckIn(clean, now);

      if (localResult === "ok") {
        setFeedback({ status: "ok", at: Date.now() });
        setCount((c) => c + 1);
        await enqueue(clean, now);
        await refreshPending();
        vibrate("ok");
        // Synchro opportuniste immédiate si en ligne
        if (isOnline) { void drainQueue(); }
      } else if (localResult === "already_local") {
        setFeedback({ status: "already_local" as CheckInResult["status"], at: Date.now() });
        vibrate("nok");
      } else {
        // Token inconnu du manifeste local → tente le serveur si en ligne
        if (isOnline) {
          const res = await checkInByTicket(linkToken, raw);
          setFeedback({ ...res, at: Date.now() });
          if (res.status === "ok") setCount((c) => c + 1);
          vibrate(res.status === "ok" ? "ok" : "nok");
        } else {
          setFeedback({ status: "invalid", at: Date.now() });
          vibrate("nok");
        }
      }
    } finally {
      setTimeout(() => { lockRef.current = false; }, 1500);
    }
  }

  function vibrate(mode: "ok" | "nok") {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(mode === "ok" ? 80 : [40, 40, 40]);
    }
  }

  async function start() {
    setCamError(null);
    // Pré-charge le manifeste avant de démarrer la caméra
    await fetchManifest();
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { void handleToken(decoded); },
        () => { /* pas de QR dans la frame */ },
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

  const fb = feedback ? (STATUS_UI[feedback.status] ?? STATUS_UI.error) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", fontFamily: "'Poppins',sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ padding: "14px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Scan billets</div>
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{eventTitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{count}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>entrées</div>
          </div>
          {/* Indicateur réseau + manifeste */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#22c55e" : "#dc2626", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              {isOnline ? "en ligne" : "hors ligne"}
              {manifestSize !== null && ` · ${manifestSize} billets`}
            </span>
          </div>
          {pendingSync > 0 && (
            <span style={{ fontSize: 10, color: "#f59e0b" }}>{pendingSync} à synchroniser</span>
          )}
        </div>
      </header>

      {/* Bandeau sync */}
      {syncMsg && (
        <div style={{ background: "#1e40af", padding: "6px 20px", fontSize: 12, textAlign: "center", color: "#bfdbfe" }}>
          🔄 {syncMsg}
        </div>
      )}

      {/* Corps */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div id={regionId} style={{ width: "100%", maxWidth: 360, borderRadius: 16, overflow: "hidden", background: "#000" }} />

        {!started && !camError && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 24 }}>
            <button onClick={() => void start()} disabled={loadingManifest} style={{ background: "#FF8A65", color: "#fff", border: "none", borderRadius: 100, padding: "14px 32px", fontSize: 16, fontWeight: 700, opacity: loadingManifest ? 0.6 : 1 }}>
              {loadingManifest ? "Chargement des billets…" : "📷 Démarrer le scan"}
            </button>
            {manifestSize !== null && manifestSize > 0 && !started && (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Manifeste en cache : {manifestSize} billets</span>
            )}
          </div>
        )}
        {camError && (
          <div style={{ marginTop: 20, textAlign: "center", color: "#fca5a5", fontSize: 14, maxWidth: 320 }}>
            Caméra indisponible : {camError}<br />
            <span style={{ color: "#94a3b8", fontSize: 12 }}>Autorisez la caméra et rechargez la page.</span>
          </div>
        )}

        {/* Bouton synchro manuelle */}
        {started && (
          <button
            onClick={() => void drainQueue()}
            disabled={!isOnline || pendingSync === 0}
            style={{ marginTop: 16, background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: isOnline && pendingSync > 0 ? "pointer" : "default" }}
          >
            🔄 Synchroniser maintenant
          </button>
        )}
      </div>

      {/* Bandeau résultat scan */}
      {fb && (
        <div style={{ background: fb.bg, padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>{fb.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fb.label}</div>
          {feedback?.fullName && (
            <div style={{ fontSize: 15, marginTop: 2 }}>
              {feedback.fullName}{feedback.seats && feedback.seats > 1 ? ` · ${feedback.seats} places` : ""}
            </div>
          )}
          {feedback?.status === "already" && feedback.checkedAt && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              à {new Date(feedback.checkedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
