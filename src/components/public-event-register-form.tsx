"use client";

import { useState } from "react";

export function PublicEventRegisterForm({ eventId, eventTitle, accentColor = "#FF8A65" }: {
  eventId: string;
  eventTitle: string;
  accentColor?: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [participants, setParticipants] = useState<string[]>([""]); // billets nominatifs supplémentaires
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ status: string; tickets: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb",
    padding: "10px 14px", fontSize: 14, outline: "none",
  };

  function setParticipant(i: number, v: string) {
    setParticipants((p) => p.map((x, idx) => (idx === i ? v : x)));
  }
  function addParticipant() { setParticipants((p) => [...p, ""]); }
  function removeParticipant(i: number) { setParticipants((p) => p.filter((_, idx) => idx !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setLoading(true); setError(null);
    try {
      // L'acheteur = 1er billet ; + participants nominatifs renseignés
      const names = [fullName.trim(), ...participants.map((p) => p.trim()).filter(Boolean)];
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, phone, participants: names }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setDone({ status: data.status, tickets: data.tickets ?? names.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    const waiting = done.status === "liste_attente";
    return (
      <div style={{ borderRadius: 16, border: `1px solid ${accentColor}40`, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>{waiting ? "🕐" : "✅"}</div>
        <h3 style={{ fontWeight: 700, fontSize: 18, color: accentColor }}>
          {waiting ? "Vous êtes sur liste d'attente" : "Inscription confirmée !"}
        </h3>
        <p style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
          {waiting
            ? "L'événement est complet. Vous serez prévenu(e) si des places se libèrent."
            : `${done.tickets} billet${done.tickets > 1 ? "s" : ""} envoyé${done.tickets > 1 ? "s" : ""} par email (un QR code par participant).`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, borderRadius: 16, border: `1px solid ${accentColor}40`, padding: 24 }}>
      <h3 style={{ fontWeight: 700, fontSize: 18, color: accentColor, margin: 0 }}>S&apos;inscrire — {eventTitle}</h3>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <label style={labelStyle}>Votre prénom & nom *</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} placeholder="Marie Dupont" />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="marie@exemple.fr" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="06 12 34 56 78" />
        </div>
      </div>

      {/* Participants supplémentaires (billets pour proches/amis) */}
      <div>
        <label style={labelStyle}>Billets supplémentaires (proches, amis…)</label>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 8px" }}>
          Un QR code nominatif sera généré pour chaque participant. Vous comptez déjà pour 1 billet.
        </p>
        {participants.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={p} onChange={(e) => setParticipant(i, e.target.value)} style={inputStyle} placeholder={`Nom du participant ${i + 1}`} />
            <button type="button" onClick={() => removeParticipant(i)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: "0 12px", color: "#9ca3af", cursor: "pointer" }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={addParticipant}
          style={{ background: "none", border: "none", color: accentColor, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>
          + Ajouter un participant
        </button>
      </div>

      {error && <p style={{ fontSize: 14, color: "#dc2626", fontWeight: 500 }}>{error}</p>}
      <button type="submit" disabled={loading}
        style={{ borderRadius: 100, padding: "12px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: accentColor, border: "none", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Inscription en cours…" : "Confirmer mon inscription →"}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: "#374151" };
