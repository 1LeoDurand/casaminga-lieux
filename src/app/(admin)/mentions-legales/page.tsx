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
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : {LEGAL.updated}</p>
        </div>

        <Section title="Éditeur du site">
          <p>Le site et la plateforme <strong>{LEGAL.product}</strong> sont édités par :</p>
          <br />
          <p>
            <strong>{LEGAL.editor}</strong> (nom commercial : {LEGAL.brandName})<br />
            {LEGAL.legalForm}<br />
            Adresse : {LEGAL.address}<br />
            SIREN : {LEGAL.siren}<br />
            SIRET (siège) : {LEGAL.siret}<br />
            RCS : {LEGAL.rcs} (immatriculé le {LEGAL.rcsDate})<br />
            N° TVA intracommunautaire : {LEGAL.vatNumber}<br />
            Code APE : {LEGAL.apeCode} — {LEGAL.apeLabel}<br />
            Email : <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>
          </p>
          {LEGAL.vatFranchise && (
            <>
              <br />
              <p style={{ fontSize: 13, color: "#6B6460" }}>
                TVA non applicable, article 293 B du Code général des impôts (franchise en base de TVA).
              </p>
            </>
          )}
        </Section>

        <Section title="Directeur de la publication">
          <p>{LEGAL.editor} — <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a></p>
        </Section>

        <Section title="Hébergement">
          <p>
            La plateforme <strong>{LEGAL.appUrl.replace("https://", "")}</strong> est hébergée par :<br /><br />
            <strong>Infomaniak Network SA</strong><br />
            Rue Eugène-Marziano 25, 1227 Les Acacias — Genève, Suisse<br />
            <a href="https://www.infomaniak.com" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>www.infomaniak.com</a>
          </p>
          <br />
          <p>
            La base de données et l'authentification sont fournies par :<br /><br />
            <strong>Supabase Inc.</strong> — infrastructure située en région Union européenne (AWS EU West, Irlande)<br />
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>supabase.com</a>
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble des éléments composant la plateforme {LEGAL.product} (architecture logicielle, code source,
            textes, interfaces, design, charte graphique, logos, marques) est la propriété exclusive de {LEGAL.editor},
            sauf mentions contraires. Toute reproduction, représentation, modification, adaptation ou exploitation, totale
            ou partielle, par quelque procédé que ce soit et sur quelque support que ce soit, sans l'autorisation préalable
            et écrite de l'éditeur, est interdite et constitue une contrefaçon sanctionnée par le Code de la propriété intellectuelle.
          </p>
          <br />
          <p>
            Les données et contenus saisis par les utilisateurs dans la plateforme restent leur propriété exclusive
            (voir les <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>CGU</Link>).
          </p>
        </Section>

        <Section title="Données personnelles">
          <p>
            Les traitements de données personnelles réalisés dans le cadre de l'utilisation de {LEGAL.product} sont
            détaillés dans notre{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
          <br />
          <p>
            Conformément au Règlement général sur la protection des données (RGPD, UE 2016/679) et à la loi
            « Informatique et Libertés » du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification,
            d'effacement, de limitation, d'opposition et de portabilité de vos données. Pour les exercer :{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>.
          </p>
          <br />
          <p>
            Vous pouvez également introduire une réclamation auprès de la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>CNIL</a>.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            La gestion des cookies et traceurs est décrite dans la{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="Conditions générales">
          <p>
            L'utilisation de la plateforme est régie par les{" "}
            <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>Conditions Générales d'Utilisation</Link>
            {" "}et, pour les offres payantes, par les{" "}
            <Link href="/cgv" style={{ color: "#E8714D", fontWeight: 600 }}>Conditions Générales de Vente</Link>.
          </p>
        </Section>

        <Section title="Crédits">
          <p>
            Conception et développement : <strong>{LEGAL.editor}</strong>.<br />
            Icônes : <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>Lucide</a>.<br />
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
          <Link href="/cgv" style={{ color: "#9C9590", textDecoration: "none" }}>CGV</Link>
        </div>
      </footer>
    </main>
  );
}
