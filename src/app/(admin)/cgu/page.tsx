import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2C", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #F0E8E2" }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: "#3A3A3A", lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

export default function CguPage() {
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
          <h1 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>Conditions Générales d'Utilisation</h1>
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : juin 2026</p>
        </div>

        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme <strong>Casa Minga Lieux</strong>, accessible à l'adresse <a href="https://admin.casaminga.com" style={{ color: "#E8714D" }}>admin.casaminga.com</a>, éditée par Léo Durand.
          </p>
          <br />
          <p>En créant un compte, vous acceptez pleinement et sans réserve les présentes CGU.</p>
        </Section>

        <Section title="2. Description du service">
          <p>
            Casa Minga Lieux est un logiciel en ligne (SaaS — Software as a Service) de pilotage pour tiers-lieux, résidences et lieux collectifs. Il offre notamment des fonctionnalités de gestion des membres, réservations, événements, adhésions, finances et communication.
          </p>
          <br />
          <p>Le service est accessible depuis tout navigateur web. Aucune installation n'est requise.</p>
        </Section>

        <Section title="3. Création de compte et accès">
          <p>Pour utiliser Casa Minga Lieux, vous devez créer un compte avec une adresse email valide et un mot de passe sécurisé. Vous êtes responsable de la confidentialité de vos identifiants.</p>
          <br />
          <p>Chaque compte correspond à une organisation (lieu, association, structure). Un même email peut être lié à plusieurs organisations.</p>
        </Section>

        <Section title="4. Conditions d'utilisation">
          <p>Vous vous engagez à :</p>
          <ul style={{ paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Fournir des informations exactes lors de l'inscription</li>
            <li>Utiliser le service conformément à la législation en vigueur</li>
            <li>Ne pas tenter d'accéder à des données d'autres organisations</li>
            <li>Ne pas utiliser le service à des fins illicites, frauduleuses ou nuisibles</li>
            <li>Respecter les droits des personnes dont vous gérez les données dans le service</li>
          </ul>
        </Section>

        <Section title="5. Données et responsabilités">
          <p>
            En tant qu'administrateur d'une organisation sur Casa Minga Lieux, vous êtes <strong>responsable de traitement</strong> au sens du RGPD pour les données des membres et contacts que vous saisissez dans la plateforme. Casa Minga Lieux agit en qualité de <strong>sous-traitant</strong> pour ces données.
          </p>
          <br />
          <p>Vous êtes seul responsable :</p>
          <ul style={{ paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>De la légalité des données que vous collectez via le service</li>
            <li>De l'information de vos membres sur l'utilisation de leurs données</li>
            <li>Du contenu publié sur votre site public généré</li>
          </ul>
        </Section>

        <Section title="6. Tarification et paiement">
          <p>
            Le service est actuellement proposé en phase pilote. Les conditions tarifaires seront communiquées avant toute facturation. Aucun prélèvement ne sera effectué sans accord préalable et explicite.
          </p>
        </Section>

        <Section title="7. Disponibilité du service">
          <p>
            Casa Minga Lieux s'efforce d'assurer la disponibilité du service 24h/24, 7j/7. Des interruptions peuvent survenir pour maintenance ou pour des raisons indépendantes de notre volonté. Nous nous engageons à vous informer à l'avance des maintenances planifiées.
          </p>
        </Section>

        <Section title="8. Propriété des données">
          <p>
            <strong>Vos données vous appartiennent.</strong> Casa Minga Lieux ne revendique aucun droit de propriété sur les données que vous saisissez dans le service. Vous pouvez les exporter et les supprimer à tout moment.
          </p>
        </Section>

        <Section title="9. Résiliation">
          <p>
            Vous pouvez résilier votre compte à tout moment en contactant <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D" }}>contact@casaminga.com</a>. Vos données seront supprimées dans un délai de 30 jours, sauf obligations légales de conservation.
          </p>
          <br />
          <p>
            Casa Minga Lieux se réserve le droit de suspendre un compte en cas de violation grave des présentes CGU, après notification préalable.
          </p>
        </Section>

        <Section title="10. Limitation de responsabilité">
          <p>
            Casa Minga Lieux est un outil d'assistance à la gestion. Il ne saurait être tenu responsable des décisions prises sur la base des informations présentes dans la plateforme, ni des erreurs de saisie de l'utilisateur.
          </p>
        </Section>

        <Section title="11. Modifications des CGU">
          <p>
            Nous nous réservons le droit de modifier les présentes CGU. Vous serez notifié par email au moins 30 jours avant toute modification substantielle. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.
          </p>
        </Section>

        <Section title="12. Droit applicable">
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents seront ceux du ressort du domicile de l'éditeur.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Pour toute question : <a href="mailto:contact@casaminga.com" style={{ color: "#E8714D", fontWeight: 600 }}>contact@casaminga.com</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/mentions-legales" style={{ color: "#9C9590", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/confidentialite" style={{ color: "#9C9590", textDecoration: "none" }}>Confidentialité</Link>
        </div>
      </footer>
    </main>
  );
}
