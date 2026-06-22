"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { acceptInvitation } from "./actions";

const inputCls =
  "w-full rounded-xl border border-[#E5DDD6] bg-[#FAFAF7] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#9C9590] outline-none transition focus:border-[#FF8A65] focus:ring-2 focus:ring-[#FF8A65]/20 disabled:opacity-60";

interface InviteData {
  email: string;
  orgName: string;
  valid: boolean;
  reason?: string;
}

export default function RejoindreTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [orgSlug, setOrgSlug] = useState("");

  // Résoudre les params (Next.js 15 async params)
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  // Charger les infos de l'invitation via fetch API
  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((data: InviteData) => setInvite(data))
      .catch(() => setInvite({ email: "", orgName: "", valid: false, reason: "Erreur réseau" }))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || password.length < 8) {
      setError("Merci de renseigner votre nom et un mot de passe d'au moins 8 caractères.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // 1. Créer le compte + lier à l'org
    const res = await acceptInvitation({ token, password, fullName: fullName.trim() });
    if (res.error) { setSubmitting(false); setError(res.error); return; }

    // 2. Se connecter immédiatement pour créer une session active
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: invite!.email,
      password,
    });
    setSubmitting(false);
    if (signInErr) {
      setError("Compte créé mais erreur de connexion automatique. Connectez-vous manuellement.");
      return;
    }

    // 3. Session active → redirection
    setOrgSlug(res.orgSlug ?? "");
    setDone(true);
    setTimeout(() => router.push(`/dashboard/${res.orgSlug}`), 1500);
  }

  // ── Chargement ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>
          <Logo />
          <p style={{ textAlign: "center", color: "#6B6460", fontSize: 14 }}>Vérification du lien…</p>
        </div>
      </main>
    );
  }

  // ── Invitation invalide / expirée ────────────────────────────────────────────
  if (!invite?.valid) {
    return (
      <main style={mainStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <Logo />
          <div style={{ fontSize: 40, margin: "12px 0" }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Lien invalide</h2>
          <p style={{ fontSize: 13, color: "#6B6460", marginBottom: 20, lineHeight: 1.6 }}>
            {invite?.reason ?? "Ce lien d'invitation est invalide ou a expiré."}
          </p>
          <Link href="/login" style={btnStyle}>← Se connecter</Link>
        </div>
      </main>
    );
  }

  // ── Succès ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <main style={mainStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <Logo />
          <div style={{ fontSize: 48, margin: "16px 0" }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Bienvenue !</h2>
          <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6 }}>
            Votre compte est créé et lié à <strong>{invite.orgName}</strong>.<br />
            Redirection en cours…
          </p>
        </div>
      </main>
    );
  }

  // ── Formulaire d'acceptation ─────────────────────────────────────────────────
  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo />
        </div>

        <div style={cardStyle}>
          {/* En-tête invitation */}
          <div style={{ textAlign: "center", marginBottom: 24, padding: "16px", background: "#FFF5F2", borderRadius: 14, border: "1px solid #FFD5C8" }}>
            <div style={{ fontSize: 13, color: "#6B6460", marginBottom: 4 }}>Vous êtes invité(e) à rejoindre</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#2C2C2C" }}>{invite.orgName}</div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Email</label>
              <input value={invite.email} disabled className={inputCls} style={{ cursor: "not-allowed" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Prénom & nom *</label>
              <input
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Pierre Causse"
                className={inputCls}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Choisissez un mot de passe *</label>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className={inputCls}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#E8714D", background: "#FFF0EB", padding: "10px 14px", borderRadius: 10 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ ...btnStyle, opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}
            >
              {submitting ? "Création en cours…" : "Rejoindre l'espace →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "#6B6460", marginTop: 20 }}>
          Déjà un compte ?{" "}
          <Link href="/login" style={{ color: "#E8714D", fontWeight: 600, textDecoration: "none" }}>Se connecter</Link>
        </p>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
      <img src="/logo-icon.webp" alt="Casa Minga Lieux" style={{ width: 40, height: 40, objectFit: "contain" }} />
      <span style={{ fontWeight: 800, fontSize: 17, color: "#2C2C2C" }}>Casa Minga Lieux</span>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 20, padding: "36px 32px",
  boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6",
};
const btnStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "14px", borderRadius: 100,
  background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15,
  border: "none", textAlign: "center", textDecoration: "none",
};
