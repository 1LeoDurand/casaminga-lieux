"use client";

import { useState } from "react";
import { subscribeNewsletterAction } from "@/app/site/[slug]/newsletter/actions";

/**
 * Formulaire d'inscription newsletter du site public (étape 1/2).
 * Réponse toujours neutre (anti-énumération). Le visiteur reçoit ensuite un
 * email de confirmation (double opt-in RGPD).
 */
export function NewsletterOptinForm({
  slug,
  accent,
  dark = false,
}: {
  slug: string;
  accent: string;
  dark?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const muted = dark ? "rgba(255,255,255,0.65)" : "#6B6460";
  const border = dark ? "rgba(255,255,255,0.25)" : "#E5DDD6";
  const fieldBg = dark ? "rgba(255,255,255,0.08)" : "#fff";
  const fieldColor = dark ? "#fff" : "#2C2C2C";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await subscribeNewsletterAction(slug, email);
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <p style={{ margin: 0, fontSize: 13.5, color: muted, maxWidth: 420, lineHeight: 1.5 }}>
        Presque&nbsp;! Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour
        finaliser votre inscription.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 420 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13.5, color: muted }}>
        Recevez les actualités et événements du lieu par email.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.fr"
          aria-label="Votre adresse email"
          style={{
            flex: "1 1 200px", minWidth: 0, padding: "10px 14px", fontSize: 14,
            borderRadius: 100, border: `1px solid ${border}`, background: fieldBg,
            color: fieldColor, outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff",
            background: accent, border: "none", borderRadius: 100,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap",
          }}
        >
          {loading ? "…" : "S'inscrire"}
        </button>
      </div>
    </form>
  );
}
