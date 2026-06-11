"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { confirmSignatureAction } from "./actions";
import type { Document } from "@/lib/types";

const DOCUMENT_TYPE_FR: Record<string, string> = {
  contrat: "Contrat", devis: "Devis", facture: "Facture",
  convention: "Convention", rapport: "Rapport", autre: "Document",
};

export function SignerClient({ doc, token }: { doc: Document; token: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  function handleSign() {
    if (!agreed) return;
    startTransition(async () => {
      const res = await confirmSignatureAction(token);
      if (res.ok) setDone(true);
      else setError(res.error ?? "Erreur inattendue.");
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBF0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 20, border: "1px solid #F0E8E0", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        {/* Header */}
        <div style={{ background: "#FF8A65", padding: "24px 32px", textAlign: "center" }}>
          <span style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "8px 16px", color: "#fff", fontSize: 18, fontWeight: 800 }}>
            Signature électronique
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "32px" }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: "#22C55E", margin: "0 auto 16px" }} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#2C2C2C", marginBottom: 8 }}>Document signé !</h1>
              <p style={{ fontSize: 15, color: "#4A4540", lineHeight: 1.6 }}>Votre signature a bien été enregistrée. Vous pouvez fermer cette page.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <FileText style={{ width: 32, height: 32, color: "#FF8A65", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9590", marginBottom: 2 }}>
                    {DOCUMENT_TYPE_FR[doc.type] ?? "Document"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#2C2C2C" }}>{doc.title}</div>
                </div>
              </div>

              {doc.file_url && /^https?:\/\//i.test(doc.file_url) ? (
                <div style={{ marginBottom: 20 }}>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FAFAF7", border: "1px solid #E5DDD6", borderRadius: 10, padding: "10px 16px", color: "#FF8A65", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                    📄 Consulter le document avant signature
                  </a>
                </div>
              ) : null}

              <div style={{ background: "#FFF8F5", border: "1px solid #F0E8E0", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#4A4540", lineHeight: 1.7 }}>
                  En cliquant sur « Signer », vous confirmez avoir pris connaissance du document ci-dessus et vous apposez votre signature électronique.
                </p>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ marginTop: 3, accentColor: "#FF8A65", width: 16, height: 16, flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, color: "#2C2C2C", lineHeight: 1.5 }}>
                  J&apos;ai lu et je comprends le document. Je consens à apposer ma signature électronique.
                </span>
              </label>

              {error ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#EF4444", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#DC2626" }}>{error}</span>
                </div>
              ) : null}

              <button
                onClick={handleSign}
                disabled={!agreed || pending}
                style={{
                  width: "100%", padding: "14px", borderRadius: 100, fontSize: 15, fontWeight: 700,
                  background: agreed && !pending ? "#FF8A65" : "#E5DDD6",
                  color: agreed && !pending ? "#fff" : "#9C9590",
                  border: "none", cursor: agreed && !pending ? "pointer" : "not-allowed",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {pending ? "Enregistrement…" : "Signer le document"}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: "#FFF8F5", borderTop: "1px solid #F0E8E0", padding: "16px 32px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#9C9590" }}>
            Ce lien est strictement personnel et ne peut être utilisé qu&apos;une seule fois.
          </p>
        </div>
      </div>
    </div>
  );
}
