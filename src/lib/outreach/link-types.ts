/**
 * Types locaux du lien signé (pages publiques /contact/<jeton>/...).
 *
 * Définis ici et non dans types.ts / status.ts : ces deux fichiers sont ceux
 * des écrans admin. Ne contient que les colonnes réellement lues par le lien.
 * Type-only : importable partout, y compris depuis un script Node.
 */

export type ContactAction = "photos" | "correction" | "stop" | "resolu" | "justificatif";

export const CONTACT_ACTIONS: readonly ContactAction[] = ["photos", "correction", "stop", "resolu", "justificatif"];

/** Rôles d'étape (outreach_program_stages.role) que le lien manipule. */
export type LinkStageRole =
  | "a_valider" | "planifie" | "attente" | "relance" | "nouveau"
  | "conversation" | "resolu" | "succes" | "clos";

export interface LinkStage {
  slug: string;
  role: LinkStageRole;
}

export interface LinkProgram {
  id: string;
  slug: string;
  label: string;
  direction: "sortant" | "entrant";
  address_form: "tu" | "vous";
  link_actions: string[];
  /** outreach_settings.link_ttl_days */
  link_ttl_days: number;
}

export interface LinkThread {
  id: string;
  program_id: string;
  contact_id: string;
  address_id: string | null;
  article_id: string | null;
  status: string;
  closed_reason: string | null;
  last_outbound_at: string | null;
  first_inbound_at: string | null;
  photos_granted_at: string | null;
  link_revoked_at: string | null;
}

export interface LinkContact {
  id: string;
  name: string;
  do_not_contact: boolean;
}

export interface ResolvedContactLink {
  thread: LinkThread;
  program: LinkProgram;
  contact: LinkContact;
  /** Adresse du fil (jamais affichée), null si elle a été supprimée. */
  addressEmail: string | null;
  stages: LinkStage[];
  articleTitle: string | null;
  issuedAtMs: number;
}
