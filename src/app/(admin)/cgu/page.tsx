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
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : {LEGAL.updated}</p>
        </div>

        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d'Utilisation (« CGU ») définissent les modalités d'accès et d'utilisation
            de la plateforme <strong>{LEGAL.product}</strong>, accessible à l'adresse{" "}
            <a href={LEGAL.appUrl} style={{ color: "#E8714D" }}>{LEGAL.appUrl.replace("https://", "")}</a>, éditée par {LEGAL.editor}
            (ci-après « l'Éditeur »).
          </p>
          <br />
          <p>
            En créant un compte ou en utilisant le service, l'utilisateur (ci-après « l'Utilisateur ») accepte pleinement
            et sans réserve les présentes CGU. Les conditions financières des offres payantes sont régies par les{" "}
            <Link href="/cgv" style={{ color: "#E8714D", fontWeight: 600 }}>Conditions Générales de Vente</Link>.
          </p>
        </Section>

        <Section title="2. Description du service">
          <p>
            {LEGAL.product} est un logiciel en ligne (SaaS — <em>Software as a Service</em>) de pilotage pour tiers-lieux,
            résidences, associations et lieux collectifs. Il propose notamment des fonctionnalités de gestion des membres
            et adhésions, des réservations d'espaces, des événements et billetterie, des finances et de la facturation,
            de la communication et d'un site public.
          </p>
          <br />
          <p>Le service est accessible depuis tout navigateur web récent. Aucune installation n'est requise.</p>
        </Section>

        <Section title="3. Création de compte et accès">
          <p>
            L'accès au service nécessite la création d'un compte au moyen d'une adresse email valide et d'un mot de passe.
            L'Utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée depuis son compte.
          </p>
          <br />
          <p>
            Chaque compte est rattaché à une ou plusieurs organisations (lieu, association, structure). L'Utilisateur garantit
            disposer de la capacité juridique et, le cas échéant, des autorisations nécessaires pour engager l'organisation
            qu'il représente.
          </p>
        </Section>

        <Section title="4. Engagements de l'Utilisateur">
          <p>L'Utilisateur s'engage à :</p>
          <ul style={ulStyle}>
            <li>Fournir des informations exactes et à jour lors de l'inscription ;</li>
            <li>Utiliser le service conformément à la législation en vigueur et aux présentes CGU ;</li>
            <li>Ne pas tenter d'accéder aux données d'autres organisations ni de compromettre la sécurité du service ;</li>
            <li>Ne pas utiliser le service à des fins illicites, frauduleuses, diffamatoires ou nuisibles ;</li>
            <li>Respecter les droits des personnes dont il gère les données dans le service.</li>
          </ul>
        </Section>

        <Section title="5. Rôles et responsabilités sur les données (RGPD)">
          <p>
            En saisissant dans la plateforme les données de ses membres, contacts ou usagers, l'organisation agit en qualité
            de <strong>responsable de traitement</strong> au sens du RGPD. {LEGAL.product} agit en qualité de{" "}
            <strong>sous-traitant</strong>, conformément à l'article 28 du RGPD et à la{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
          <br />
          <p>L'organisation est seule responsable :</p>
          <ul style={ulStyle}>
            <li>De la licéité des données qu'elle collecte via le service et de la base légale de ses traitements ;</li>
            <li>De l'information des personnes concernées et du recueil de leur consentement le cas échéant ;</li>
            <li>Du contenu qu'elle publie, notamment sur son site public généré par la plateforme.</li>
          </ul>
        </Section>

        <Section title="6. Disponibilité et maintenance">
          <p>
            L'Éditeur s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7, sans toutefois garantir une
            disponibilité ininterrompue. Des interruptions peuvent survenir pour des opérations de maintenance ou pour des
            raisons indépendantes de sa volonté. L'Éditeur s'efforce d'informer à l'avance des maintenances planifiées
            significatives. Le service est fourni en l'état, selon une obligation de moyens.
          </p>
        </Section>

        <Section title="7. Propriété des données et propriété intellectuelle">
          <p>
            <strong>Les données saisies par l'Utilisateur lui appartiennent.</strong> L'Éditeur ne revendique aucun droit
            de propriété sur ces données et s'interdit de les exploiter à d'autres fins que la fourniture du service.
            L'Utilisateur peut les exporter et en demander la suppression à tout moment.
          </p>
          <br />
          <p>
            La plateforme elle-même (code, design, marques, contenus de l'Éditeur) demeure la propriété exclusive de
            l'Éditeur. Les présentes CGU ne confèrent à l'Utilisateur qu'un droit d'usage personnel, non exclusif et non
            transférable, pour la durée de son abonnement.
          </p>
        </Section>

        <Section title="8. Limitation de responsabilité">
          <p>
            {LEGAL.product} est un outil d'assistance à la gestion. L'Éditeur ne saurait être tenu responsable des décisions
            prises par l'Utilisateur sur la base des informations présentes dans la plateforme, des erreurs de saisie, ni
            des conséquences d'une utilisation non conforme du service. La responsabilité de l'Éditeur ne peut être engagée
            pour les dommages indirects, et est en tout état de cause limitée, pour les offres payantes, au montant des
            sommes versées par l'Utilisateur au cours des douze (12) derniers mois.
          </p>
        </Section>

        <Section title="9. Suspension et résiliation">
          <p>
            L'Utilisateur peut résilier son compte à tout moment depuis son espace ou en contactant{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>. Les conditions de
            résiliation des abonnements payants sont précisées dans les{" "}
            <Link href="/cgv" style={{ color: "#E8714D", fontWeight: 600 }}>CGV</Link>.
          </p>
          <br />
          <p>
            L'Éditeur se réserve le droit de suspendre ou résilier un compte en cas de manquement grave aux présentes CGU,
            après notification et, sauf urgence ou obligation légale, mise en demeure restée sans effet. Après résiliation,
            les données sont supprimées dans les conditions prévues par la Politique de confidentialité.
          </p>
        </Section>

        <Section title="10. Modification des CGU">
          <p>
            L'Éditeur peut modifier les présentes CGU. L'Utilisateur est informé par email ou via la plateforme au moins
            trente (30) jours avant l'entrée en vigueur de toute modification substantielle. La poursuite de l'utilisation
            du service après cette date vaut acceptation des nouvelles conditions.
          </p>
        </Section>

        <Section title="11. Droit applicable et litiges">
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige, les parties s'efforcent de trouver une
            solution amiable avant toute action judiciaire. À défaut d'accord, le litige sera porté devant les tribunaux
            français compétents.
          </p>
          <br />
          <p style={{ fontSize: 13, color: "#6B6460" }}>
            Pour les Utilisateurs ayant la qualité de consommateur, des dispositions spécifiques (médiation de la
            consommation, plateforme européenne de règlement en ligne des litiges) sont prévues dans les{" "}
            <Link href="/cgv" style={{ color: "#E8714D" }}>CGV</Link>.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Pour toute question : <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D", fontWeight: 600 }}>{LEGAL.email}</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E5DDD6", padding: "24px 28px", textAlign: "center", fontSize: 13, color: "#9C9590" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none" }}>Accueil</Link>
          <Link href="/mentions-legales" style={{ color: "#9C9590", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/confidentialite" style={{ color: "#9C9590", textDecoration: "none" }}>Confidentialité</Link>
          <Link href="/cgv" style={{ color: "#9C9590", textDecoration: "none" }}>CGV</Link>
        </div>
      </footer>
    </main>
  );
}
