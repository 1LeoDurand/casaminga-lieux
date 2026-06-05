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
  const [seats, setSeats] = useState("1");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"inscrit" | "liste_attente" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, phone, seats: parseInt(seats) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setDone(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={{ borderColor: accentColor + "40" }}>
        <div className="mb-2 text-3xl">{done === "liste_attente" ? "🕐" : "✅"}</div>
        <h3 className="font-bold text-lg" style={{ color: accentColor }}>
          {done === "liste_attente" ? "Vous êtes sur liste d'attente" : "Inscription confirmée !"}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {done === "liste_attente"
            ? "L'événement est complet. Vous serez prévenu(e) si une place se libère."
            : "Un email de confirmation vous a été envoyé."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border p-6" style={{ borderColor: accentColor + "40" }}>
      <h3 className="font-bold text-lg" style={{ color: accentColor }}>S'inscrire</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-gray-700">Prénom & Nom *</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400"
            placeholder="Marie Dupont" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-gray-700">Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400"
            placeholder="marie@exemple.fr" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-gray-700">Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400"
            placeholder="06 12 34 56 78" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-gray-700">Nombre de places</label>
          <input type="number" min={1} max={10} value={seats} onChange={(e) => setSeats(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-gray-400" />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="rounded-full px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        style={{ background: accentColor }}>
        {loading ? "Inscription en cours…" : "Confirmer mon inscription →"}
      </button>
    </form>
  );
}
