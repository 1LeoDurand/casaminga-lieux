import Link from "next/link";
import type { Metadata } from "next";
import { confirmerRevendication, type ConfirmResult } from "@/lib/claims/revendication";
import { mainStyle, cardStyle, btnStyle } from "../../[slug]/styles";

/**
 * Le clic qui autorise Casaminga à écrire au lieu.
 *
 * C'est le troisième garde-fou de la revendication, et le seul qui arrête un
 * script : déposer une demande ne coûte rien, mais plus rien ne part vers un
 * lieu tant que le demandeur n'a pas prouvé qu'il relève l'adresse qu'il a
 * saisie. Les deux autres limites (par IP, par lieu) vivent dans l'action de
 * dépôt et dans `lib/claims/revendication.ts`.
 *
 * La page agit sur un simple GET, comme la confirmation de newsletter : les
 * clients de messagerie pré-chargent les liens, d'où l'idempotence côté
 * `confirmerRevendication` — deux visites n'envoient pas deux invitations.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmer votre demande | Casa Minga",
  robots: { index: false, follow: false },
};

export default async function ConfirmerRevendicationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await confirmerRevendication(token);
  const { titre, corps } = message(res);

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <Logo />
        <div style={cardStyle}>
          <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 12px" }}>{titre}</h1>
          {corps.map((t, i) => (
            <p key={i} style={paraStyle}>
              {t}
            </p>
          ))}
          <Link href="/login" style={{ ...btnStyle, marginTop: 8 }}>
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Ce que le demandeur doit lire, selon ce qui vient de se passer. */
function message(res: ConfirmResult): { titre: string; corps: string[] } {
  const lieu = res.orgName ?? "ce lieu";

  switch (res.etat) {
    case "ok":
      if (res.saturation) {
        return {
          titre: "Votre demande est confirmée",
          corps: [
            `${lieu} a déjà reçu plusieurs messages de notre part ces derniers jours. Nous ne lui en enverrons pas un de plus : votre demande passe en relecture, et c'est nous qui la traiterons.`,
            "Nous revenons vers vous sous quelques jours, à cette adresse.",
          ],
        };
      }
      if (res.voie === "auto") {
        return {
          titre: "Votre demande est confirmée",
          corps: [
            `Le lien de reprise vient de partir à l'adresse de contact que ${lieu} a publiée${
              res.adresseIndice ? ` (${res.adresseIndice})` : ""
            }, et non à la vôtre.`,
            "C'est notre façon de vérifier qu'une page n'est reprise que par quelqu'un du lieu, sans vous demander de justificatif. Si vous relevez cette boîte, le lien vous y attend. Sinon, demandez-le à la personne qui s'en occupe.",
          ],
        };
      }
      return {
        titre: "Votre demande est confirmée",
        corps: [
          `${lieu} n'a pas publié d'adresse de contact : nous ne pouvons pas vérifier votre demande automatiquement, et nous ne confierons pas une page à quelqu'un sur sa seule parole.`,
          "Elle part donc en relecture. Nous revenons vers vous sous quelques jours, et il se peut que nous vous appelions avant.",
        ],
      };

    case "deja":
      return {
        titre: "C'est déjà fait",
        corps: [
          `Cette demande a déjà été confirmée : il n'y a rien à refaire, et rien n'est parti deux fois.`,
          "Si vous attendez toujours une réponse, écrivez-nous à contact@casaminga.com.",
        ],
      };

    case "expire":
      return {
        titre: "Ce lien a expiré",
        corps: [
          "Les liens de confirmation ne vivent que quelques heures, pour qu'aucun ne traîne.",
          `Reprenez la demande depuis la page de ${lieu} : elle ne prend qu'une minute.`,
        ],
      };

    case "indisponible":
      return {
        titre: "Cette page a déjà été reprise",
        corps: [
          `Entre votre demande et maintenant, l'équipe de ${lieu} a repris sa page.`,
          "Si vous en faites partie, demandez-leur de vous inviter depuis leur espace.",
        ],
      };

    case "inconnu":
      return {
        titre: "Lien invalide",
        corps: [
          "Ce lien ne correspond à aucune demande. Il a peut-être été tronqué en chemin par votre logiciel de messagerie.",
          "Recommencez depuis la page du lieu, ou écrivez-nous à contact@casaminga.com.",
        ],
      };

    default:
      return {
        titre: "Confirmation impossible",
        corps: [
          "Nous n'arrivons pas à joindre nos données pour l'instant. Réessayez dans un moment — votre demande, elle, est bien enregistrée.",
        ],
      };
  }
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

const paraStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  lineHeight: 1.65,
  color: "#4A4540",
};
