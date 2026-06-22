import Link from "next/link";
import { LEGAL } from "@/lib/legal";

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

const ulStyle: React.CSSProperties = { paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 };

export default function ConfidentialitePage() {
  return (
    <main style={{ fontFamily: "'Poppins', sans-serif", background: "#FFFBF0", color: "#2C2C2C", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,251,240,0.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,180,162,0.28)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "#2C2C2C", textDecoration: "none" }}>
            <img src="/logo-icon.webp" alt="Casa Minga Lieux" style={{ width: 34, height: 34, objectFit: "contain" }} />
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
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : {LEGAL.updated} — Conforme au RGPD (UE) 2016/679</p>
        </div>

        <Section title="Qui sommes-nous ?">
          <p>
            <strong>{LEGAL.product}</strong> est un logiciel SaaS de pilotage pour tiers-lieux et lieux collectifs, édité
            par {LEGAL.editor}. En utilisant notre service, vous nous confiez des données ; nous prenons cette
            responsabilité au sérieux.
          </p>
          <br />
          <p>
            <strong>Responsable du traitement</strong> (pour les données de comptes et d'abonnement) : {LEGAL.editor} —{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>.
          </p>
          <br />
          <p style={{ fontSize: 13, color: "#6B6460" }}>
            Pour les données des membres et contacts saisis par une organisation dans la plateforme, l'organisation est
            responsable de traitement et {LEGAL.product} agit comme sous-traitant (article 28 du RGPD).
          </p>
        </Section>

        <Section title="Données collectées">
          <p style={{ marginBottom: 16 }}>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
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
                <DataRow what="Données de l'organisation" why="Fonctionnement du service" base="Contrat" duration="Durée du compte + 3 ans" />
                <DataRow what="Données des membres (CRM)" why="Gestion par l'organisation" base="Contrat (sous-traitance)" duration="Durée du compte" />
                <DataRow what="Données d'abonnement et de paiement" why="Facturation des offres payantes" base="Contrat / obligation légale" duration="10 ans (comptabilité)" />
                <DataRow what="Logs techniques" why="Sécurité et débogage" base="Intérêt légitime" duration="90 jours" />
                <DataRow what="Mesure d'audience" why="Statistiques de fréquentation" base="Consentement" duration="13 mois max." />
                <DataRow what="Feedback envoyé" why="Amélioration du service" base="Consentement" duration="2 ans" />
              </tbody>
            </table>
          </div>
          <br />
          <p style={{ fontSize: 13, color: "#6B6460" }}>
            Les numéros de carte bancaire ne sont jamais stockés par {LEGAL.product} : ils sont traités directement par
            notre prestataire de paiement (voir ci-dessous).
          </p>
        </Section>

        <Section title="Ce que nous ne faisons jamais">
          <ul style={ulStyle}>
            <li>❌ Nous ne vendons pas vos données, à personne, jamais.</li>
            <li>❌ Nous n'exploitons pas vos données à des fins publicitaires.</li>
            <li>❌ Nous n'accédons pas aux données des membres d'une organisation, sauf nécessité de support à sa demande, ou obligation légale.</li>
          </ul>
          <br />
          <p>
            Vos données métier (comptes, organisations, membres) sont hébergées dans l'Union européenne. Certains
            sous-traitants techniques (paiement, mesure d'audience) peuvent être établis hors UE ; les transferts éventuels
            sont alors encadrés par des garanties appropriées (clauses contractuelles types de la Commission européenne ou
            cadre <em>EU-US Data Privacy Framework</em>).
          </p>
        </Section>

        <Section title="Hébergement et sous-traitants">
          <p>Nous faisons appel aux sous-traitants suivants, tous soumis à un accord de traitement (DPA) conforme au RGPD :</p>
          <br />
          <ul style={ulStyle}>
            <li><strong>Infomaniak</strong> (Genève, Suisse) — hébergement applicatif et envoi des emails. La Suisse bénéficie d'une décision d'adéquation de la Commission européenne.</li>
            <li><strong>Supabase</strong> (AWS EU West, Irlande) — base de données et authentification.</li>
            <li><strong>Stripe Payments Europe</strong> — traitement des paiements par carte des abonnements <em>(activé pour les offres payantes)</em>.</li>
            <li><strong>Google (Google Analytics)</strong> — mesure d'audience du site, déposée uniquement après votre consentement <em>(le cas échéant)</em>.</li>
          </ul>
        </Section>

        <Section title="Cookies et traceurs">
          <p>
            {LEGAL.product} utilise des <strong>cookies strictement nécessaires</strong> au fonctionnement de la plateforme
            (session d'authentification, sécurité). Ces cookies ne requièrent pas votre consentement.
          </p>
          <br />
          <p>
            Nous utilisons par ailleurs des <strong>cookies de mesure d'audience</strong> (Google Analytics) destinés à
            établir des statistiques de fréquentation. Ces cookies ne sont déposés qu'<strong>après recueil de votre
            consentement</strong>, que vous pouvez accepter ou refuser, et retirer à tout moment. Aucun cookie publicitaire
            n'est utilisé.
          </p>
        </Section>

        <Section title="Vos droits">
          <p>Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :</p>
          <br />
          <ul style={ulStyle}>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données ;</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes ;</li>
            <li><strong>Droit à l'effacement</strong> : supprimer votre compte et vos données ;</li>
            <li><strong>Droit à la limitation</strong> et <strong>droit d'opposition</strong> : encadrer certains traitements ;</li>
            <li><strong>Droit à la portabilité</strong> : exporter vos données dans un format standard.</li>
          </ul>
          <br />
          <p>
            Pour exercer ces droits : <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D", fontWeight: 600 }}>{LEGAL.email}</a>. Réponse sous un (1) mois.
          </p>
          <br />
          <p>
            En cas de désaccord, vous pouvez introduire une réclamation auprès de la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>CNIL</a>.
          </p>
        </Section>

        <Section title="Export et suppression de compte">
          <p>
            Vos données sont exportables à tout moment depuis votre tableau de bord. Pour supprimer votre compte et
            l'ensemble de vos données, contactez-nous à{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>. La suppression est effective
            sous trente (30) jours, à l'exception des données soumises à une obligation légale de conservation
            (comptabilité : 10 ans).
          </p>
        </Section>

        <Section title="Sécurité">
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :
            chiffrement des communications (HTTPS), cloisonnement des données par organisation (politiques de sécurité au
            niveau de la base), authentification sécurisée et journalisation des accès.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Pour toute question relative à cette politique : <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D", fontWeight: 600 }}>{LEGAL.email}</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/mentions-legales" style={{ color: "#9C9590", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/cgu" style={{ color: "#9C9590", textDecoration: "none" }}>CGU</Link>
          <Link href="/cgv" style={{ color: "#9C9590", textDecoration: "none" }}>CGV</Link>
        </div>
      </footer>
    </main>
  );
}
