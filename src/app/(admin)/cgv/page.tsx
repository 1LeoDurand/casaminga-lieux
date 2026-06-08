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
          <h1 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>Conditions Générales de Vente</h1>
          <p style={{ fontSize: 14, color: "#6B6460" }}>Dernière mise à jour : {LEGAL.updated}</p>
        </div>

        <Section title="1. Objet et champ d'application">
          <p>
            Les présentes Conditions Générales de Vente (« CGV ») régissent la souscription aux offres payantes de la
            plateforme <strong>{LEGAL.product}</strong>, éditée par {LEGAL.editor} (ci-après « l'Éditeur »), par toute
            personne physique ou morale souscrivant un abonnement (ci-après « le Client »).
          </p>
          <br />
          <p>
            Elles complètent les{" "}
            <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>Conditions Générales d'Utilisation</Link>.
            La souscription d'une offre payante emporte acceptation pleine et entière des présentes CGV.
          </p>
        </Section>

        <Section title="2. Offres et fonctionnalités">
          <p>{LEGAL.product} est proposé selon un modèle « freemium » :</p>
          <ul style={ulStyle}>
            <li>
              <strong>Offre gratuite</strong> — accès à un socle de fonctionnalités (gestion des adhésions, événements et
              site public), sans limitation de durée et sans engagement de paiement.
            </li>
            <li>
              <strong>Offres payantes par abonnement</strong> — déblocage de fonctionnalités avancées (facturation,
              dépenses, gouvernance, multi-lieux, etc.). Le détail des offres et leur contenu sont présentés sur la page
              Tarifs de la plateforme, qui prévaut en cas de divergence.
            </li>
          </ul>
          <br />
          <p>
            L'Éditeur peut faire évoluer le périmètre des offres ; toute réduction substantielle des fonctionnalités d'une
            offre en cours est notifiée au Client dans les conditions de l'article 9.
          </p>
        </Section>

        <Section title="3. Prix">
          <p>
            Les prix des abonnements sont indiqués en euros sur la page Tarifs de la plateforme. Ils sont fermes pour la
            durée de la période d'abonnement en cours.
          </p>
          <br />
          {LEGAL.vatFranchise ? (
            <p>
              <strong>TVA non applicable, article 293 B du Code général des impôts</strong> (l'Éditeur bénéficie de la
              franchise en base de TVA). Les prix affichés sont nets de taxe.
            </p>
          ) : (
            <p>
              Les prix sont indiqués hors taxes (HT) et toutes taxes comprises (TTC). La TVA applicable est celle en
              vigueur au jour de la facturation.
            </p>
          )}
        </Section>

        <Section title="4. Souscription et facturation">
          <p>
            La souscription s'effectue en ligne depuis la plateforme. L'abonnement est conclu pour une durée d'un (1) mois
            ou d'un (1) an selon l'option choisie, et se renouvelle automatiquement par tacite reconduction pour des
            périodes identiques, sauf résiliation dans les conditions de l'article 7.
          </p>
          <br />
          <p>
            Le paiement intervient à la souscription puis à chaque renouvellement, par carte bancaire via notre prestataire
            de paiement sécurisé. Une facture est émise et mise à disposition du Client pour chaque échéance. Conformément
            à l'article L. 215-1 du Code de la consommation, le Client consommateur est informé par écrit, au plus tôt trois
            mois et au plus tard un mois avant le terme de la période, de la possibilité de ne pas reconduire le contrat.
          </p>
        </Section>

        <Section title="5. Prestataire de paiement">
          <p>
            Les paiements sont traités par <strong>Stripe Payments Europe, Ltd.</strong>, prestataire de services de
            paiement agréé. L'Éditeur n'a jamais accès aux numéros de carte bancaire du Client, qui sont transmis de manière
            chiffrée directement à Stripe. En cas d'incident de paiement, l'accès aux fonctionnalités payantes peut être
            suspendu après notification.
          </p>
        </Section>

        <Section title="6. Droit de rétractation">
          <p>
            Conformément aux articles L. 221-18 et suivants du Code de la consommation, le Client <strong>consommateur</strong>
            {" "}dispose d'un délai de quatorze (14) jours à compter de la souscription pour exercer son droit de rétractation,
            sans avoir à motiver sa décision.
          </p>
          <br />
          <p>
            Toutefois, le Client peut demander à bénéficier du service immédiatement. En commençant à utiliser une
            fonctionnalité payante avant la fin du délai de rétractation, il <strong>demande expressément l'exécution
            immédiate</strong> du service et reconnaît que son droit de rétractation prend fin une fois le service
            pleinement exécuté, ou qu'il devra régler le montant correspondant à l'usage effectué jusqu'à sa rétractation
            (article L. 221-25 du Code de la consommation).
          </p>
          <br />
          <p style={{ fontSize: 13, color: "#6B6460" }}>
            Le droit de rétractation ne s'applique pas aux Clients professionnels (associations, entreprises, collectivités)
            agissant dans le cadre de leur activité.
          </p>
        </Section>

        <Section title="7. Durée, résiliation et remboursement">
          <p>
            Le Client peut résilier son abonnement à tout moment depuis son espace ou en écrivant à{" "}
            <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>. La résiliation prend effet
            au terme de la période d'abonnement en cours : le Client conserve l'accès aux fonctionnalités payantes
            jusqu'à cette date, et aucun renouvellement n'est facturé ensuite.
          </p>
          <br />
          <p>
            Sauf exercice du droit de rétractation (article 6) ou disposition légale impérative, les sommes versées au titre
            d'une période entamée ne sont pas remboursées. En cas de retour à l'offre gratuite, les données du Client sont
            conservées dans les limites de cette offre.
          </p>
        </Section>

        <Section title="8. Disponibilité du service">
          <p>
            L'Éditeur est tenu à une obligation de moyens quant à la disponibilité et au bon fonctionnement du service.
            Les modalités de disponibilité et de maintenance sont précisées à l'article 6 des{" "}
            <Link href="/cgu" style={{ color: "#E8714D", fontWeight: 600 }}>CGU</Link>. En cas d'indisponibilité prolongée
            imputable à l'Éditeur, le Client pourra demander un avoir au prorata de la durée d'indisponibilité.
          </p>
        </Section>

        <Section title="9. Modification des offres et des prix">
          <p>
            L'Éditeur peut modifier ses offres et tarifs. Toute modification de prix d'un abonnement en cours est notifiée
            au Client au moins trente (30) jours avant son entrée en vigueur, au prochain renouvellement. Le Client qui
            n'accepte pas la modification peut résilier son abonnement avant cette date, sans frais.
          </p>
        </Section>

        <Section title="10. Responsabilité">
          <p>
            La responsabilité de l'Éditeur au titre des présentes CGV est limitée, tous préjudices confondus, au montant
            des sommes effectivement versées par le Client au cours des douze (12) mois précédant le fait générateur.
            L'Éditeur ne saurait être tenu responsable des dommages indirects. Les présentes stipulations ne limitent pas
            les droits dont bénéficie le Client consommateur au titre des garanties légales.
          </p>
        </Section>

        <Section title="11. Données personnelles">
          <p>
            Les traitements de données réalisés dans le cadre de l'abonnement sont décrits dans la{" "}
            <Link href="/confidentialite" style={{ color: "#E8714D", fontWeight: 600 }}>Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="12. Droit applicable et règlement des litiges">
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige, le Client s'adresse en priorité à l'Éditeur
            pour rechercher une solution amiable.
          </p>
          <br />
          <p>
            <strong>Médiation de la consommation.</strong> Conformément aux articles L. 612-1 et suivants du Code de la
            consommation, le Client consommateur peut recourir gratuitement à un médiateur de la consommation en vue de la
            résolution amiable d'un litige.{" "}
            <span style={{ color: "#6B6460" }}>
              {/* ⚠️ À COMPLÉTER : nom et coordonnées du médiateur de la consommation auquel l'Éditeur adhère. */}
              Les coordonnées du médiateur compétent sont communiquées sur demande à{" "}
              <a href={`mailto:${LEGAL.email}`} style={{ color: "#E8714D" }}>{LEGAL.email}</a>.
            </span>
          </p>
          <br />
          <p>
            Le Client consommateur peut également utiliser la plateforme européenne de Règlement en Ligne des Litiges (RLL) :{" "}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: "#E8714D" }}>ec.europa.eu/consumers/odr</a>.
          </p>
          <br />
          <p style={{ fontSize: 13, color: "#6B6460" }}>
            À défaut de résolution amiable, le litige sera porté devant les tribunaux français compétents.
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
