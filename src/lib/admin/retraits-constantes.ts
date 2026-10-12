/** Client-safe constants for the withdrawals page (no server import here). */

export type Portee = "medias" | "fiches" | "import";
export type Canal = "courriel" | "telephone" | "formulaire" | "equipe" | "plainte";

export const PORTEES: { value: Portee; label: string; aide: string }[] = [
  { value: "medias", label: "Retirer les médias", aide: "Les faits restent (titre, date, lieu, lien d'origine). La description et les photos sont retirées." },
  { value: "fiches", label: "Retirer les fiches", aide: "Plus aucune fiche de cette organisation sur le site, et sa vitrine technique est retirée. Les imports futurs créent les fiches masquées." },
  { value: "import", label: "Ne plus importer", aide: "Comme « retirer les fiches », et plus rien n'est créé : ni organisation, ni fiche. Le lieu de l'annuaire est masqué. Sans source, tous les imports sont concernés ; avec une source, seule celle-là est refusée." },
];

export const CANAUX: { value: Canal; label: string }[] = [
  { value: "courriel", label: "Courriel" },
  { value: "telephone", label: "Téléphone" },
  { value: "formulaire", label: "Formulaire" },
  { value: "equipe", label: "Constat de l'équipe" },
  { value: "plainte", label: "Plainte formelle" },
];

const MESSAGES: Record<string, string> = {
  retrait_portee_invalide: "La portée du retrait n'est pas reconnue.",
  retrait_source_invalide: "Une source ne se précise que pour « Ne plus importer ».",
  retrait_auteur_manquant: "Votre identité n'a pas pu être lue : reconnectez-vous.",
  retrait_cible_manquante: "Choisissez une organisation ou un lieu de l'annuaire.",
  retrait_lieu_introuvable: "Ce lieu de l'annuaire n'existe pas ou plus.",
  retrait_organisation_introuvable: "Cette organisation n'existe pas ou plus.",
  retrait_organisation_revendiquee:
    "Cette organisation a été revendiquée ou est gérée par ses membres : elle gère ses fiches depuis son espace, un retrait n'est pas possible ici.",
  retrait_deja_actif: "Un retrait identique est déjà actif pour cette cible. Levez-le d'abord si vous voulez le refaire.",
  retrait_introuvable: "Ce retrait n'existe pas.",
  retrait_deja_leve: "Ce retrait est déjà levé.",
};

/** Turns a raw database error into a readable sentence. */
export function messageRetrait(raw: string | null | undefined): string {
  const m = /retrait_[a-z_]+/.exec(raw ?? "");
  if (m && MESSAGES[m[0]]) return MESSAGES[m[0]];
  return "Le retrait a échoué. Rien n'a été modifié ; réessayez ou prévenez le développeur.";
}

