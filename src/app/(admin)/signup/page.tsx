"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ORG_ARCHETYPES } from "@/lib/modules";
import { trackEvent } from "@/lib/analytics";
import { createOrgAndMember } from "./actions";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "mon-lieu";
}

const inputCls = "w-full rounded-xl border border-[#E5DDD6] bg-[#FAFAF7] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#9C9590] outline-none transition focus:border-[#FF8A65] focus:ring-2 focus:ring-[#FF8A65]/20";

const STEPS = [
  { key: "account",   label: "Votre compte" },
  { key: "lieu",      label: "Votre lieu" },
  { key: "archetype", label: "Personnaliser" },
] as const;
type StepKey = typeof STEPS[number]["key"];

export default function SignupPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [step, setStep] = useState<StepKey>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [lieuName, setLieuName] = useState("");
  const [lieuStructure, setLieuStructure] = useState("association");
  const [lieuEmail, setLieuEmail] = useState("");
  const [orgType, setOrgType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Compte déjà authentifié mais sans espace (récupération d'un compte orphelin) :
  // on saute la création de compte et on passe directement à la création du lieu.
  const [recoverUser, setRecoverUser] = useState<{ id: string; email: string } | null>(null);

  const slug = slugify(lieuName);

  // Détecte une session existante → mode « finaliser mon espace » (orphelin).
  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u?.id && u.email) {
        setRecoverUser({ id: u.id, email: u.email });
        setEmail(u.email);
        if (u.user_metadata?.full_name) setFullName(u.user_metadata.full_name as string);
        setStep("lieu"); // le compte existe déjà : on commence à l'étape du lieu
      }
    });
  }, [configured]);

  async function submit(selectedOrgType: string) {
    setError(null);
    setLoading(true);
    const supabase = createClient();

    // Identifiant utilisateur : session existante (récupération) sinon création.
    let userId = recoverUser?.id ?? null;
    let hasSession = !!recoverUser;

    if (!userId) {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authErr || !authData.user) {
        setError(authErr?.message ?? "Erreur lors de la création du compte.");
        setLoading(false);
        return;
      }
      userId = authData.user.id;
      hasSession = !!authData.session;
    }

    const { orgSlug, error: orgError } = await createOrgAndMember({
      userId,
      slug,
      name: lieuName,
      structure: lieuStructure,
      email: lieuEmail || email,
      orgType: selectedOrgType,
    });

    setLoading(false);
    if (orgError || !orgSlug) {
      setError(orgError ?? "Le lieu n'a pas pu être créé.");
      return;
    }
    setDone(true);
    // Conversion : nouvel espace lieu créé.
    trackEvent("sign_up", {
      method: recoverUser ? "recover" : "email",
      structure: lieuStructure,
      org_type: selectedOrgType,
    });
    // Session active (auto-confirmation ou compte déjà connecté) → on entre direct.
    if (hasSession) {
      setTimeout(() => router.push(`/dashboard/${orgSlug}`), 1200);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "account") { setStep("lieu"); return; }
    if (step === "lieu") { setStep("archetype"); return; }
  }

  // ── États terminaux ───────────────────────────────────────────────────────
  if (!configured) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6", textAlign: "center" }}>
          <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 52, height: 52, objectFit: "contain", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Supabase non configuré</h2>
          <p style={{ fontSize: 14, color: "#6B6460", marginBottom: 20, lineHeight: 1.6 }}>L'inscription nécessite que les variables d'environnement Supabase soient configurées.</p>
          <Link href="/login" style={{ display: "block", padding: "12px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>← Retour à la connexion</Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Bienvenue !</h2>
          <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, marginBottom: 20 }}>
            Votre espace <strong>{lieuName}</strong> est créé.<br />
            On vous y emmène… Si rien ne se passe, cliquez ci-dessous.
          </p>
          <Link href={`/dashboard/${slug}`} style={{ display: "block", padding: "12px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Entrer dans mon espace →</Link>
        </div>
      </main>
    );
  }

  // ── Étape archétype (hors formulaire classique) ────────────────────────
  if (step === "archetype") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 580, width: "100%" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#2C2C2C", fontWeight: 800, fontSize: 18 }}>
              <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 40, height: 40, objectFit: "contain" }} />
              Casa Minga Lieux
            </Link>
          </div>

          <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6" }}>
            {/* Stepper */}
            <Stepper current="archetype" />

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, marginTop: 24 }}>Quel est votre lieu ?</h2>
            <p style={{ fontSize: 13, color: "#6B6460", marginBottom: 20, lineHeight: 1.5 }}>
              On pré-configure les bons outils pour vous. Modifiable à tout moment dans Modules.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {ORG_ARCHETYPES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setOrgType(a.key)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `2px solid ${orgType === a.key ? "#FF8A65" : "#E5DDD6"}`,
                    background: orgType === a.key ? "#FFF5F2" : "#FAFAF7",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color .15s, background .15s",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{a.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2C", marginBottom: 2 }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: "#6B6460", lineHeight: 1.4 }}>{a.description}</div>
                </button>
              ))}
            </div>

            {error && <p style={{ fontSize: 13, color: "#E8714D", background: "#FFF0EB", padding: "10px 14px", borderRadius: 10, marginBottom: 12 }}>{error}</p>}

            <button
              type="button"
              disabled={!orgType || loading}
              onClick={() => submit(orgType!)}
              style={{ width: "100%", padding: "14px", borderRadius: 100, background: orgType && !loading ? "#FF8A65" : "#FFB4A2", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: orgType && !loading ? "pointer" : "not-allowed", transition: "background .15s" }}
            >
              {loading ? "Création en cours…" : "Créer mon espace →"}
            </button>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" onClick={() => setStep("lieu")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6460", textDecoration: "underline" }}>
                ← Retour
              </button>
              <button
                type="button"
                onClick={() => submit("autre")}
                disabled={loading}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6460", textDecoration: "underline" }}
              >
                Passer cette étape
              </button>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: "#6B6460", marginTop: 20 }}>
            Déjà un compte ?{" "}
            <Link href="/login" style={{ color: "#E8714D", fontWeight: 600, textDecoration: "none" }}>Se connecter</Link>
          </p>
        </div>
      </main>
    );
  }

  // ── Étapes compte + lieu ──────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 460, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#2C2C2C", fontWeight: 800, fontSize: 18 }}>
            <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 40, height: 40, objectFit: "contain" }} />
            Casa Minga Lieux
          </Link>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6" }}>
          <Stepper current={step} />

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
            {step === "account" && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Créer votre compte</h2>
                <p style={{ fontSize: 13, color: "#6B6460", marginBottom: 4 }}>Vous serez administrateur de votre lieu.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Prénom & nom *</label>
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Léo Durand" className={inputCls} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Email *</label>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leo@monlieu.fr" className={inputCls} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Mot de passe *</label>
                  <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" className={inputCls} />
                </div>
              </>
            )}

            {step === "lieu" && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Votre lieu</h2>
                <p style={{ fontSize: 13, color: "#6B6460", marginBottom: 4 }}>Ces informations créent l'espace de gestion de votre lieu.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Nom du lieu *</label>
                  <input required value={lieuName} onChange={(e) => setLieuName(e.target.value)} placeholder="Tiers-lieu Les Halles" className={inputCls} />
                  {lieuName && (
                    <span style={{ fontSize: 11, color: "#6B6460" }}>
                      URL : admin.casaminga.com/dashboard/<strong>{slug}</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Type de structure *</label>
                  <select value={lieuStructure} onChange={(e) => setLieuStructure(e.target.value)} className={inputCls} style={{ cursor: "pointer" }}>
                    <option value="association">Association loi 1901</option>
                    <option value="scic">SCIC</option>
                    <option value="scop">SCOP</option>
                    <option value="collectif">Collectif informel</option>
                    <option value="etablissement">Établissement public</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Email du lieu (facultatif)</label>
                  <input type="email" value={lieuEmail} onChange={(e) => setLieuEmail(e.target.value)} placeholder="contact@monlieu.fr" className={inputCls} />
                </div>
                {error && <p style={{ fontSize: 13, color: "#E8714D", background: "#FFF0EB", padding: "10px 14px", borderRadius: 10 }}>{error}</p>}
              </>
            )}

            <button type="submit" style={{ padding: "14px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginTop: 4, transition: "background .15s" }}>
              Continuer →
            </button>

            {step === "lieu" && (
              <button type="button" onClick={() => setStep("account")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6460", textDecoration: "underline" }}>
                ← Revenir à l'étape précédente
              </button>
            )}
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

// ── Composant stepper partagé ─────────────────────────────────────────────
function Stepper({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: done || active ? "#FF8A65" : "#F4EFE9",
                color: done || active ? "#fff" : "#9C9590",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#2C2C2C" : "#9C9590", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: "#E5DDD6", margin: "0 8px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
