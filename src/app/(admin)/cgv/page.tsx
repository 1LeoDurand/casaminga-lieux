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

const ulStyle: React.CSSProperties = { paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 };

export default function CgvPage() {
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
            Légal
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>Conditions Générales de Vente</h1>
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : {LEGAL.updated}</p>
        </div>

        {/* Champ d'application B2B */}
        <div style={{ marginBottom: 32, padding: "14px 18px", borderRadius: 12, background: "#FFF0EB", border: "1px solid #FFB4A2", fontSize: 13.5, color: "#7A4030" }}>
          <strong>Clients professionnels uniquement.</strong> Les présentes CGV s'appliquent exclusivement aux personnes morales (associations, entreprises, collectivités, structures professionnelles) concluant un abonnement dans le cadre de leur activité. {LEGAL.product} n'est pas destiné aux consommateurs particuliers agissant à titre privé.
        </div>

        <Section title="1. Objet et champ d'application">
          <p>
            Les présentes Conditions Générales de Vente (« CGV ») régissent la souscription aux offres payantes de la
            plateforme <strong>{LEGAL.product}</strong>, éditée par {LEGAL.editor} (ci-après « l'Éditeur »), par tout
            client professionnel (ci-après « le Client »).
          </p>
          <br />
          <p>
            Elles complètent les{" "}
            <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>Conditions Générales d'Utilisation</Link>.
            La souscription d'une offre payante emporte acceptation pleine et entière des présentes CGV, qui prévalent
            sur tout autre document du Client.
          </p>
        </Section>

        <Section title="2. Offres et fonctionnalités">
          <p>{LEGAL.product} est proposé selon un modèle « freemium » :</p>
          <ul style={ulStyle}>
            <li>
              <strong>Offre gratuite</strong> — accès à un socle de fonctionnalités (adhésions, événements, site public),
              sans limitation de durée et sans engagement de paiement.
            </li>
            <li>
              <strong>Offres payantes par abonnement</strong> — déblocage de fonctionnalités avancées (facturation,
              dépenses, gouvernance, multi-lieux, etc.). Le détail des offres et leur contenu sont présentés sur la page
              Tarifs, qui prévaut en cas de divergence avec tout autre document.
            </li>
          </ul>
          <br />
          <p>
            L'Éditeur peut faire évoluer le périmètre des offres. Toute réduction substantielle des fonctionnalités d'une
            offre en cours est notifiée au Client dans les conditions de l'article 8.
          </p>
        </Section>

        <Section title="3. Prix">
          <p>
            Les prix des abonnements sont indiqués en euros sur la page Tarifs. Ils sont fermes pour la durée de la
            période d'abonnement en cours.
          </p>
          <br />
          <p>
            <strong>TVA non applicable, article 293 B du Code général des impôts</strong> (franchise en base de TVA).
            Les prix affichés sont nets de toute taxe.
          </p>
        </Section>

        <Section title="4. Souscription et facturation">
          <p>
            La souscription s'effectue en ligne depuis la plateforme. L'abonnement est conclu pour une durée d'un (1) mois
            ou d'un (1) an selon l'option choisie, et se renouvelle automatiquement par tacite reconduction pour des
            périodes identiques, sauf résiliation dans les conditions de l'article 6.
          </p>
          <br />
          <p>
            Le paiement intervient à la souscription puis à chaque renouvellement, par carte bancaire via notre prestataire
            de paiement sécurisé. Une facture est mise à disposition du Client pour chaque échéance.
          </p>
        </Section>

        <Section title="5. Prestataire de paiement">
          <p>
            Les paiements sont traités par <strong>Stripe Payments Europe, Ltd.</strong>, prestataire de services de
            paiement agréé. L'Éditeur n'a jamais accès aux numéros de carte du Client. En cas d'incident de paiement,
            l'accès aux fonctionnalités payantes peut être suspendu après notification.
          </p>
        </Section>

        <Section title="6. Durée, résiliation">
          <p>
            Le Client peut résilier son abonnement à tout moment depuis son espace ou par email à{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>. La résiliation prend effet
            au terme de la période d'abonnement en cours : le Client conserve l'accès aux fonctionnalités payantes
            jusqu'à cette date, sans renouvellement ultérieur.
          </p>
          <br />
          <p>
            Sauf disposition légale impérative, les sommes versées au titre d'une période entamée ne sont pas
            remboursées. En cas de retour à l'offre gratuite, les données sont conservées dans les limites de cette offre.
          </p>
        </Section>

        <Section title="7. Disponibilité du service">
          <p>
            L'Éditeur est tenu à une obligation de moyens quant à la disponibilité du service (voir article 6 des{" "}
            <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>CGU</Link>). En cas d'indisponibilité
            prolongée imputable à l'Éditeur, le Client pourra demander un avoir au prorata de la durée d'indisponibilité.
          </p>
        </Section>

        <Section title="8. Modification des offres et des prix">
          <p>
            Toute modification de prix d'un abonnement en cours est notifiée au Client au moins trente (30) jours avant
            son entrée en vigueur, au prochain renouvellement. Le Client qui n'accepte pas la modification peut résilier
            son abonnement avant cette date sans frais.
          </p>
        </Section>

        <Section title="9. Responsabilité">
          <p>
            La responsabilité de l'Éditeur est limitée, tous préjudices confondus, au montant des sommes effectivement
            versées par le Client au cours des douze (12) mois précédant le fait générateur. L'Éditeur ne saurait être
            tenu responsable des dommages indirects (perte d'exploitation, manque à gagner, atteinte à l'image).
          </p>
        </Section>

        <Section title="10. Données personnelles">
          <p>
            Les traitements de données réalisés dans le cadre de l'abonnement sont décrits dans la{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="11. Droit applicable et juridiction">
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige, les parties recherchent une solution
            amiable avant toute action judiciaire. À défaut d'accord, le litige sera porté devant les tribunaux
            compétents du ressort du siège de l'Éditeur (Montpellier), nonobstant pluralité de défendeurs ou appel en
            garantie, y compris pour les procédures d'urgence ou les procédures conservatoires.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {LEGAL.editor} — <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D", fontWeight: 600 }}>{LEGAL.email}</a><br />
            {LEGAL.address}
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/mentions-legales" style={{ color: "#9C9590", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/confidentialite" style={{ color: "#9C9590", textDecoration: "none" }}>Confidentialité</Link>
          <Link href="/cgu" style={{ color: "#9C9590", textDecoration: "none" }}>CGU</Link>
        </div>
      </footer>
    </main>
  );
}
