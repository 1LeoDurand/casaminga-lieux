"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ORG_ARCHETYPES } from "@/lib/modules";
import { createOrgAndMember } from "../signup/actions";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "mon-lieu";
}

const inputCls = "w-full rounded-xl border border-[#E5DDD6] bg-[#FAFAF7] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#9C9590] outline-none transition focus:border-[#FF8A65] focus:ring-2 focus:ring-[#FF8A65]/20";

/**
 * Formulaire de finalisation d'espace pour un compte déjà authentifié.
 * Deux étapes : infos du lieu, puis choix de l'archétype → createOrgAndMember.
 * Aucun signUp ici : le compte existe déjà (userId fourni par la page serveur).
 */
export function OnboardingForm({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"lieu" | "archetype">("lieu");
  const [lieuName, setLieuName] = useState("");
  const [lieuStructure, setLieuStructure] = useState("association");
  const [lieuEmail, setLieuEmail] = useState("");
  const [orgType, setOrgType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const slug = slugify(lieuName);

  async function submit(selectedOrgType: string) {
    setError(null);
    setLoading(true);
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
    setTimeout(() => router.push(`/dashboard/${orgSlug}`), 1000);
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Espace prêt !</h2>
          <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, marginBottom: 20 }}>
            Votre espace <strong>{lieuName}</strong> est créé. On vous y emmène…
          </p>
          <Link href={`/dashboard/${slug}`} style={{ display: "block", padding: "12px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Entrer dans mon espace →</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: step === "archetype" ? 580 : 460, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#2C2C2C", fontWeight: 800, fontSize: 18 }}>
            <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 40, height: 40, objectFit: "contain" }} />
            Casa Minga Lieux
          </Link>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6" }}>
          {/* Bandeau de contexte : compte existant, espace à finaliser */}
          <div style={{ fontSize: 12.5, color: "#6B6460", background: "#FFF5F2", border: "1px solid #FFE0D6", borderRadius: 12, padding: "10px 14px", marginBottom: 20, lineHeight: 1.5 }}>
            Bonjour <strong>{fullName || email}</strong> 👋 — votre compte existe déjà.
            Il ne reste plus qu'à créer votre espace.
          </div>

          {step === "lieu" && (
            <form
              onSubmit={(e) => { e.preventDefault(); setStep("archetype"); }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
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
              <button type="submit" style={{ padding: "14px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginTop: 4 }}>
                Continuer →
              </button>
            </form>
          )}

          {step === "archetype" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Quel est votre lieu ?</h2>
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
                      padding: "14px 16px", borderRadius: 14,
                      border: `2px solid ${orgType === a.key ? "#FF8A65" : "#E5DDD6"}`,
                      background: orgType === a.key ? "#FFF5F2" : "#FAFAF7",
                      cursor: "pointer", textAlign: "left",
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
                style={{ width: "100%", padding: "14px", borderRadius: 100, background: orgType && !loading ? "#FF8A65" : "#FFB4A2", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: orgType && !loading ? "pointer" : "not-allowed" }}
              >
                {loading ? "Création en cours…" : "Créer mon espace →"}
              </button>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" onClick={() => setStep("lieu")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6460", textDecoration: "underline" }}>
                  ← Retour
                </button>
                <button type="button" onClick={() => submit("autre")} disabled={loading} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6460", textDecoration: "underline" }}>
                  Passer cette étape
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
