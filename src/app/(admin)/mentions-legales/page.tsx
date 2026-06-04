import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2C", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #F0E8E2" }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: "#3A3A3A", lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

export default function MentionsLegalesPage() {
  return (
    <main style={{ fontFamily: "'Poppins', sans-serif", background: "#FFFBF0", color: "#2C2C2C", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,251,240,0.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,180,162,0.28)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "#2C2C2C", textDecoration: "none" }}>
            <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 34, height: 34, objectFit: "contain" }} />
            Casa Minga Lieux
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: "#6B6460", textDecoration: "none" }}>← Accueil</Link>
        </div>
      </nav>

      {/* CONTENU */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(48px,7vw,80px) 28px clamp(64px,9vw,96px)" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", borderRadius: 100, border: "1px solid #FFB4A2", background: "#FFF0EB", color: "#E8714D", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "4px 14px", marginBottom: 16 }}>
            Légal
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>Mentions légales</h1>
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : juin 2026</p>
        </div>

        <Section title="Éditeur du site">
          <p><strong>Casa Minga Lieux</strong> est édité par :</p>
          <br />
          <p><strong>Léo Durand</strong><br />
          Micro-entrepreneur / Auto-entrepreneur<br />
          {/* ⚠️ À COMPLÉTER : adresse, SIRET */}
          Adresse : <em>[À compléter]</em><br />
          SIRET : <em>[À compléter]</em><br />
          Email : <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a>
          </p>
        </Section>

        <Section title="Hébergement">
          <p>
            Le site <strong>admin.casaminga.com</strong> est hébergé par :<br /><br />
            <strong>Infomaniak Network SA</strong><br />
            Rue Eugène-Marziano 25, 1227 Les Acacias — Genève, Suisse<br />
            <a href="https://www.infomaniak.com" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>www.infomaniak.com</a>
          </p>
          <br />
          <p>
            La base de données est hébergée par :<br /><br />
            <strong>Supabase Inc.</strong> — infrastructure en région EU West (Irlande)<br />
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>supabase.com</a>
          </p>
        </Section>

        <Section title="Directeur de la publication">
          <p>Léo Durand — <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a></p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble des contenus présents sur ce site (textes, images, logos, design) est la propriété exclusive de Casa Minga Lieux ou fait l'objet d'une autorisation d'utilisation. Toute reproduction, représentation, modification ou exploitation, totale ou partielle, est interdite sans l'accord préalable et écrit de l'éditeur.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p>
            Les données collectées dans le cadre de l'utilisation de Casa Minga Lieux sont traitées conformément à notre{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
          <br />
          <p>
            Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Pour exercer ces droits : <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a>
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Ce site utilise des cookies techniques strictement nécessaires au fonctionnement de la plateforme (authentification, session). Aucun cookie publicitaire ou de tracking tiers n'est déposé.
          </p>
        </Section>

        <Section title="Crédits">
          <p>
            Design et développement : <strong>Léo Durand</strong> avec l'assistance de <strong>Claude (Anthropic)</strong>.<br />
            Icônes : <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>Lucide React</a>.<br />
            Police : <a href="https://fonts.google.com/specimen/Poppins" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>Poppins</a> (Google Fonts).
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/confidentialite" style={{ color: "#9C9590", textDecoration: "none" }}>Confidentialité</Link>
          <Link href="/cgu" style={{ color: "#9C9590", textDecoration: "none" }}>CGU</Link>
        </div>
      </footer>
    </main>
  );
}
