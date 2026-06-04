import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2C", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #F0E8E2" }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: "#3A3A3A", lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

function DataRow({ what, why, base, duration }: { what: string; why: string; base: string; duration: string }) {
  return (
    <tr style={{ borderBottom: "1px solid #F0E8E2" }}>
      <td style={{ padding: "10px 12px", fontWeight: 600, verticalAlign: "top", fontSize: 13 }}>{what}</td>
      <td style={{ padding: "10px 12px", color: "#3A3A3A", fontSize: 13 }}>{why}</td>
      <td style={{ padding: "10px 12px", color: "#6B6460", fontSize: 13 }}>{base}</td>
      <td style={{ padding: "10px 12px", color: "#6B6460", fontSize: 13, whiteSpace: "nowrap" }}>{duration}</td>
    </tr>
  );
}

export default function ConfidentialitePage() {
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
            RGPD
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>Politique de confidentialité</h1>
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : juin 2026 — Conforme RGPD (UE) 2016/679</p>
        </div>

        <Section title="Qui sommes-nous ?">
          <p>
            <strong>Casa Minga Lieux</strong> est un logiciel SaaS de pilotage pour tiers-lieux et lieux collectifs, édité par Léo Durand.<br />
            En utilisant notre service, vous nous confiez des données. Nous prenons cette responsabilité au sérieux.
          </p>
          <br />
          <p><strong>Responsable du traitement :</strong> Léo Durand — <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a></p>
        </Section>

        <Section title="Données collectées">
          <p style={{ marginBottom: 16 }}>Nous collectons uniquement les données strictement nécessaires au fonctionnement du service :</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #F0E8E2", borderRadius: 12, overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#FFF0EB" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Donnée</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Finalité</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Base légale</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Durée</th>
                </tr>
              </thead>
              <tbody>
                <DataRow what="Email, nom" why="Authentification et communication" base="Contrat" duration="Durée du compte + 3 ans" />
                <DataRow what="Données de l'organisation" why="Fonctionnement du service" base="Contrat" duration="Durée du compte + 5 ans" />
                <DataRow what="Données des membres CRM" why="Gestion par l'organisation" base="Contrat" duration="Durée du compte" />
                <DataRow what="Transactions, factures" why="Comptabilité et obligations légales" base="Obligation légale" duration="10 ans" />
                <DataRow what="Logs techniques" why="Sécurité et débogage" base="Intérêt légitime" duration="90 jours" />
                <DataRow what="Feedback envoyé" why="Amélioration du service" base="Consentement" duration="2 ans" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Ce que nous ne faisons jamais">
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>❌ Nous ne revendons pas vos données, à personne, jamais.</li>
            <li>❌ Nous n'utilisons pas vos données à des fins publicitaires.</li>
            <li>❌ Nous ne transférons pas vos données hors de l'Union européenne.</li>
            <li>❌ Nous n'accédons pas aux données de vos membres sans votre accord explicite.</li>
          </ul>
        </Section>

        <Section title="Hébergement et sous-traitants">
          <p>Vos données sont hébergées sur des infrastructures situées en Europe :</p>
          <br />
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Infomaniak</strong> — hébergement applicatif (Genève, Suisse)</li>
            <li><strong>Supabase</strong> — base de données (AWS EU West, Irlande)</li>
          </ul>
          <br />
          <p>Ces sous-traitants sont soumis à des DPA (Data Processing Agreements) conformes au RGPD.</p>
        </Section>

        <Section title="Vos droits">
          <p>Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :</p>
          <br />
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : supprimer votre compte et vos données</li>
            <li><strong>Droit à la portabilité</strong> : exporter vos données dans un format standard</li>
            <li><strong>Droit d'opposition</strong> : vous opposer à certains traitements</li>
          </ul>
          <br />
          <p>Pour exercer ces droits : <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D", fontWeight: 600 }}>contact@casaminga.com</a>. Réponse sous 30 jours.</p>
          <br />
          <p>En cas de désaccord, vous pouvez saisir la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>CNIL</a>.</p>
        </Section>

        <Section title="Export et suppression de compte">
          <p>
            Vos données sont exportables à tout moment depuis votre dashboard. Si vous souhaitez supprimer votre compte et l'ensemble de vos données, contactez-nous à <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a>. La suppression est effective sous 30 jours, sauf données soumises à obligation légale de conservation (comptabilité : 10 ans).
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Casa Minga Lieux n'utilise que des cookies techniques strictement nécessaires (session d'authentification). Aucun cookie publicitaire, de tracking ou d'analyse comportementale tiers n'est déposé.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Pour toute question relative à cette politique : <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D", fontWeight: 600 }}>contact@casaminga.com</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/mentions-legales" style={{ color: "#9C9590", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/cgu" style={{ color: "#9C9590", textDecoration: "none" }}>CGU</Link>
        </div>
      </footer>
    </main>
  );
}
