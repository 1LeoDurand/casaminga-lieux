import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: "24px", textAlign: "center" }}>
      <div style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 72, marginBottom: 12, lineHeight: 1 }}>🏚️</div>
        <div style={{ display: "inline-flex", alignItems: "center", borderRadius: 100, border: "1px solid #FFB4A2", background: "#FFF0EB", color: "#E8714D", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "4px 14px", marginBottom: 20 }}>
          Erreur 404
        </div>
        <h1 style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 14, color: "#2C2C2C" }}>
          Cette page n'existe pas.
        </h1>
        <p style={{ fontSize: 15, color: "#6B6460", lineHeight: 1.7, marginBottom: 32 }}>
          Le lien que vous avez suivi est peut-être obsolète, ou la page a été déplacée. Aucun bénévole n'a été blessé dans l'affaire.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{ padding: "13px 26px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 6px 18px rgba(255,138,101,0.28)" }}
          >
            ← Retour à l'accueil
          </Link>
          <Link
            href="/login"
            style={{ padding: "13px 26px", borderRadius: 100, background: "transparent", border: "1.5px solid #E5DDD6", color: "#2C2C2C", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}
