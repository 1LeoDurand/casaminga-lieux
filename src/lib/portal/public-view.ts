/**
 * Vue de l'espace adhérent servie à casaminga.com par GET /api/espace/donnees.
 *
 * Pourquoi une projection plutôt que PortalData tel quel : la réponse quitte
 * l'admin pour un site tiers. On n'y laisse que ce qui s'affiche, sans
 * identifiant interne (org, adhésion, facture, reçu, réservation), et on
 * fabrique ici les liens vers les pages existantes de l'admin, pour que le
 * site public n'ait ni à connaître leurs chemins ni à dupliquer les PDF.
 *
 * Contrat documenté dans docs/API-ESPACE.md : toute modification des champs
 * ci-dessous doit y être reportée.
 */
import "server-only";
import type { AdhesionStatus, FactureStatus, PortalData } from "@/lib/portal/data";
import { PORTAL_ADMIN_BASE } from "@/lib/portal/url";

export interface PortalViewAdhesion {
  status: AdhesionStatus;
  tierName: string | null;
  amount: number;
  membershipStart: string | null;
  membershipEnd: string | null;
  /** Formulaire d'adhésion de la campagne ouverte du lieu, s'il y en a une. */
  renewUrl: string | null;
  /** Attestation PDF, seulement pour une adhésion en cours. */
  attestationUrl: string | null;
  /** Page « je ne renouvelle pas », proposée quand l'échéance approche. */
  declineRenewalUrl: string | null;
}

export interface PortalViewBillet {
  holderName: string;
  eventTitle: string;
  eventStartAt: string;
  /** Billet avec QR code (page publique de l'admin, protégée par le jeton du billet). */
  ticketUrl: string;
}

export interface PortalViewReservation {
  title: string | null;
  spaceName: string | null;
  startAt: string;
  endAt: string | null;
  status: string;
  /** Détail et annulation de la réservation. */
  manageUrl: string;
}

export interface PortalViewRecu {
  number: string | null;
  year: number;
  amount: number;
  donationDate: string;
  /** Reçu fiscal PDF. */
  pdfUrl: string;
}

export interface PortalViewFacture {
  number: string | null;
  object: string | null;
  amountTtc: number;
  dueDate: string | null;
  issueDate: string | null;
  status: FactureStatus;
  canDeclare: boolean;
  /** Page de la facture : état du règlement et déclaration de paiement. */
  url: string;
}

export interface PortalViewOrg {
  orgSlug: string;
  orgName: string;
  displayName: string;
  adhesion: PortalViewAdhesion | null;
  billets: PortalViewBillet[];
  reservations: PortalViewReservation[];
  recus: PortalViewRecu[];
  factures: PortalViewFacture[];
}

export interface PortalView {
  email: string;
  orgs: PortalViewOrg[];
}

/** Segment de chemin sûr : les identifiants viennent de la base, on les encode quand même. */
const seg = encodeURIComponent;

export function toPortalView(data: PortalData, token: string): PortalView {
  const espace = `${PORTAL_ADMIN_BASE}/espace/${seg(token)}`;

  return {
    email: data.email,
    orgs: data.orgs.map((org) => {
      const a = org.adhesion;
      const enCours = a !== null && (a.derivedStatus === "active" || a.derivedStatus === "expire_bientot");
      return {
        orgSlug: org.orgSlug,
        orgName: org.orgName,
        displayName: org.displayName,
        adhesion: a
          ? {
              status: a.derivedStatus,
              tierName: a.tierName,
              amount: a.amount,
              membershipStart: a.membershipStart,
              membershipEnd: a.membershipEnd,
              // Le formulaire de campagne vit dans l'admin sous /site/<lieu>/adhesion :
              // casaminga.com (site statique) ne sert pas cette route.
              renewUrl: org.activeCampaignSlug
                ? `${PORTAL_ADMIN_BASE}/site/${seg(org.orgSlug)}/adhesion/${seg(org.activeCampaignSlug)}`
                : null,
              attestationUrl: enCours ? `${espace}/attestation/${seg(org.orgSlug)}` : null,
              declineRenewalUrl:
                a.derivedStatus === "expire_bientot" ? `${espace}/adhesion/${seg(a.id)}` : null,
            }
          : null,
        billets: org.billets.map((b) => ({
          holderName: b.holderName,
          eventTitle: b.eventTitle,
          eventStartAt: b.eventStartAt,
          ticketUrl: `${PORTAL_ADMIN_BASE}/billet/${seg(b.ticketToken)}`,
        })),
        reservations: org.reservations.map((r) => ({
          title: r.title,
          spaceName: r.spaceName,
          startAt: r.startAt,
          endAt: r.endAt,
          status: r.status,
          manageUrl: `${espace}/reservation/${seg(r.id)}`,
        })),
        recus: org.recus.map((r) => ({
          number: r.number,
          year: r.year,
          amount: r.amount,
          donationDate: r.donationDate,
          pdfUrl: `${espace}/recu/${seg(r.id)}`,
        })),
        factures: org.factures.map((f) => ({
          number: f.number,
          object: f.object,
          amountTtc: f.amountTtc,
          dueDate: f.dueDate,
          issueDate: f.issueDate,
          status: f.derivedStatus,
          canDeclare: f.canDeclare,
          url: `${espace}/facture/${seg(f.id)}`,
        })),
      };
    }),
  };
}
