"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "mon-lieu";
}

const inputCls = "w-full rounded-xl border border-[#E5DDD6] bg-[#FAFAF7] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#9C9590] outline-none transition focus:border-[#FF8A65] focus:ring-2 focus:ring-[#FF8A65]/20";

export default function SignupPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [step, setStep] = useState<"account" | "lieu">("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [lieuName, setLieuName] = useState("");
  const [lieuStructure, setLieuStructure] = useState("association");
  const [lieuEmail, setLieuEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const slug = slugify(lieuName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "account") { setStep("lieu"); return; }

    setError(null);
    setLoading(true);
    const supabase = createClient();

    // 1. Créer le compte Supabase Auth
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
    const userId = authData.user.id;

    // 2. Créer l'organisation
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ slug, name: lieuName, structure: lieuStructure, email: lieuEmail || email, plan: "pilot" })
      .select("id, slug")
      .single();
    if (orgErr || !org) {
      setError("Le lieu n'a pas pu être créé. Le nom est peut-être déjà utilisé.");
      setLoading(false);
      return;
    }

    // 3. Lier user → org (admin)
    await supabase.from("organization_members").insert({
      user_id: userId,
      organization_id: org.id,
      role: "admin",
      status: "actif",
    });

    setLoading(false);
    setDone(true);

    // Si session directe (email non vérifié requis = false), on redirige
    if (authData.session) {
      setTimeout(() => router.push(`/dashboard/${org.slug}`), 1500);
    }
  }

  if (!configured) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#FF8A65,#FF6D4D)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, margin: "0 auto 16px" }}>CM</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Supabase non configuré</h2>
          <p style={{ fontSize: 14, color: "#6B6460", marginBottom: 20, lineHeight: 1.6 }}>L'inscription nécessite que les variables d'environnement Supabase soient configurées sur le serveur.</p>
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
            Vérifiez votre email pour confirmer votre compte, puis connectez-vous.
          </p>
          <Link href="/login" style={{ display: "block", padding: "12px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Se connecter →</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 460, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#2C2C2C", fontWeight: 800, fontSize: 18 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#FF8A65,#FF6D4D)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>CM</span>
            Casa Minga Lieux
          </Link>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6" }}>
          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
            {[{ n: 1, label: "Votre compte", key: "account" }, { n: 2, label: "Votre lieu", key: "lieu" }].map((s, i) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: step === s.key || (s.key === "account" && step === "lieu") ? "#FF8A65" : "#F4EFE9", color: step === s.key || (s.key === "account" && step === "lieu") ? "#fff" : "#9C9590", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {s.key === "account" && step === "lieu" ? "✓" : s.n}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: step === s.key ? 600 : 400, color: step === s.key ? "#2C2C2C" : "#9C9590" }}>{s.label}</span>
                </div>
                {i === 0 && <div style={{ flex: 1, height: 1, background: "#E5DDD6", margin: "0 12px" }} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

            <button type="submit" disabled={loading} style={{ padding: "14px", borderRadius: 100, background: loading ? "#FFB4A2" : "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", marginTop: 4, transition: "background .15s" }}>
              {loading ? "Création en cours…" : step === "account" ? "Continuer →" : "Créer mon espace"}
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
