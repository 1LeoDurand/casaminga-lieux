import Link from "next/link";
import type { Metadata } from "next";
import { loadClaimTarget, type ClaimTarget } from "./data";
import { ClaimForm } from "./form";
import { mainStyle, cardStyle, btnStyle } from "./styles";

/**
 * casaminga.com/…/revendiquer → admin.casaminga.com/revendiquer/<slug>
 *
 * Le portail public est un site statique : il ne peut ni écrire en base, ni
 * envoyer un courriel. Tout le transactionnel vit ici, et la revendication ne
 * fait pas exception. Cette page est donc l'une des deux seules de
 * l'application qu'un visiteur voit sans compte, avec /rejoindre/[token] —
 * elle est hors du groupe (admin), et le middleware ne la protège pas.
 *
 * Elle n'est pas indexable : 118 pages presque identiques, une par lieu
 * moissonné, seraient des pages satellites aux yeux d'un moteur, et le compte
 * Ad Grant de l'association n'a rien à y gagner. On y arrive par un lien
 * depuis la fiche d'événement, jamais par une recherche.
 */

export const metadata: Metadata = {
  title: "Reprendre la page de votre lieu | Casa Minga",
  robots: { index: false, follow: false },
};

export default async function RevendiquerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ evenement?: string }>;
}) {
  const { slug } = await params;
  const { evenement } = await searchParams;
  const target = await loadClaimTarget(slug, evenement ?? null);

  if (!target) {
    return (
      <Refus
        titre="Page indisponible"
        texte="Nous n'arrivons pas à joindre nos données pour l'instant. Réessayez dans un moment."
      />
    );
  }

  if (target.refus) return <RefusConnu target={target} />;

  return (
    <main style={{ ...mainStyle, alignItems: "flex-start", paddingTop: 48, paddingBottom: 48 }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <Logo />

        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <span
            style={{
              display: "inline-block",
              background: "#FFF5F2",
              border: "1px solid #FFD5C8",
              color: "#E8714D",
              borderRadius: 100,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            Page reprise d&apos;un agenda ouvert
          </span>

          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "14px 0 10px", lineHeight: 1.25 }}>
            {target.name}
          </h1>

          {target.address && (
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "#6B6460" }}>{target.address}</p>
          )}

          <p style={paraStyle}>
            Casaminga rassemble les rendez-vous ouverts du territoire. Les événements de ce lieu y
            ont été repris depuis un agenda public en Licence Ouverte
            {target.nbEvenements > 0 ? (
              <>
                {" "}
                : <strong>{formatEvenements(target.nbEvenements)}</strong>
              </>
            ) : null}
            . Personne de chez vous n&apos;a eu à le demander, et personne n&apos;en a la main.
          </p>

          {target.eventTitre && (
            <p style={{ ...paraStyle, fontSize: 14, color: "#6B6460" }}>
              Vous arrivez depuis « {target.eventTitre} ».
            </p>
          )}

          <p style={paraStyle}>En reprenant cette page, vous obtenez :</p>
          <ul style={listeStyle}>
            <li>vos événements déjà en ligne, que vous pouvez corriger ou retirer ;</li>
            <li>la possibilité de publier les suivants vous-même ;</li>
            <li>une page de présentation de votre lieu, visible dans l&apos;annuaire ;</li>
            <li>les demandes des visiteurs, qui vous parviendront directement.</li>
          </ul>
          <p style={{ ...paraStyle, fontSize: 14, color: "#6B6460", marginBottom: 0 }}>
            C&apos;est gratuit, et vous restez libre de tout retirer.
          </p>
        </div>

        <ClaimForm target={target} />

        <p style={{ textAlign: "center", fontSize: 13, color: "#6B6460", marginTop: 20 }}>
          Vous préférez que ce lieu ne figure pas sur Casaminga ?{" "}
          <a
            href={`mailto:contact@casaminga.com?subject=${encodeURIComponent(
              `Retrait de ${target.name} de Casaminga`
            )}`}
            style={{ color: "#E8714D", fontWeight: 600, textDecoration: "none" }}
          >
            Demandez son retrait
          </a>
          , nous le ferons sans discuter.
        </p>
      </div>
    </main>
  );
}

function RefusConnu({ target }: { target: ClaimTarget }) {
  if (target.refus === "inconnu") {
    return (
      <Refus
        titre="Ce lieu n'est pas sur Casaminga"
        texte="Le lien que vous avez suivi ne correspond à aucun lieu. Il a peut-être été tronqué en chemin."
      />
    );
  }
  if (target.refus === "deja_revendique") {
    return (
      <Refus
        titre="Cette page a déjà été reprise"
        texte={`L'équipe de ${target.name} gère désormais cette page. Si vous en faites partie, demandez-leur de vous inviter depuis leur espace.`}
      />
    );
  }
  return (
    <Refus
      titre="Ce lieu gère déjà sa page"
      texte={`${target.name} a un espace sur Casa Minga et n'a rien à revendiquer. Si vous en faites partie, demandez à son équipe de vous inviter.`}
    />
  );
}

function Refus({ titre, texte }: { titre: string; texte: string }) {
  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 460, width: "100%" }}>
        <Logo />
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>{titre}</h1>
          <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.65, marginBottom: 22 }}>
            {texte}
          </p>
          <Link href="/login" style={btnStyle}>
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.webp"
        alt="Casa Minga Lieux"
        style={{ width: 40, height: 40, objectFit: "contain" }}
      />
      <span style={{ fontWeight: 800, fontSize: 17, color: "#2C2C2C" }}>Casa Minga Lieux</span>
    </div>
  );
}

function formatEvenements(n: number): string {
  return n > 1 ? `${n} de vos rendez-vous y figurent déjà` : "un de vos rendez-vous y figure déjà";
}

const paraStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  lineHeight: 1.65,
  color: "#4A4540",
};

const listeStyle: React.CSSProperties = {
  margin: "0 0 14px",
  paddingLeft: 20,
  fontSize: 15,
  lineHeight: 1.8,
  color: "#4A4540",
};
