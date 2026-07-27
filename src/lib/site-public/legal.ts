/**
 * Mentions légales et politique de confidentialité des sites de lieux.
 *
 * Pourquoi ces pages sont obligatoires, et pas optionnelles comme les autres :
 *  - les mentions légales sont imposées à tout éditeur de site par la LCEN
 *    (art. 6 III) dès lors qu'il s'agit d'une personne morale ;
 *  - la politique de confidentialité l'est dès qu'une donnée est collectée —
 *    or chaque site publie un formulaire de contact, et la newsletter peut
 *    déposer un pixel de suivi.
 *
 * Règle de conduite de ce module : **ne jamais inventer une information
 * légale**. Ce que nous ne savons pas est signalé comme à compléter, jamais
 * comblé par une valeur vraisemblable. Une mention légale fausse est un risque
 * plus grand qu'une mention incomplète, et ce sont nos clients qui le portent.
 */

import "server-only";
import type { Organization } from "@/lib/types";

/** Hébergeur du site — c'est nous qui le fournissons, donc nous le connaissons. */
export const HEBERGEUR = {
  nom: "Infomaniak Network SA",
  adresse: "Rue Eugène-Marziano 25, 1227 Genève, Suisse",
  site: "https://www.infomaniak.com",
} as const;

export const EDITEUR_LOGICIEL = "Casa Minga Lieux";

export interface LegalInfo {
  /** Dénomination de la structure. */
  nom: string;
  /** Association loi 1901, SCIC, SAS… tel que renseigné dans le profil. */
  structure: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  siret: string | null;
  /**
   * Champs légalement exigés que nous ne détenons pas encore. Sert à afficher
   * une mention honnête côté public et une consigne côté tableau de bord.
   */
  manquants: string[];
}

export function buildLegalInfo(org: Organization): LegalInfo {
  const manquants: string[] = [];
  if (!org.address) manquants.push("adresse du siège");
  if (!org.email) manquants.push("adresse de contact");
  if (!org.siret) manquants.push("numéro SIRET ou RNA");
  // Le directeur de la publication est le représentant légal (président·e pour
  // une association). Nous ne stockons pas encore cette information.
  manquants.push("directeur ou directrice de la publication");

  return {
    nom: org.name,
    structure: org.structure,
    adresse: org.address,
    email: org.email,
    telephone: org.phone,
    siret: org.siret ?? null,
    manquants,
  };
}

/** Phrase affichée à la place d'une information légale que nous n'avons pas. */
export const A_COMPLETER = "Information à compléter par la structure.";
