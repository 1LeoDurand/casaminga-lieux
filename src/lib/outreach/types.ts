/**
 * Types of the contacts module (outreach_*). Aligned with the schema APPLIED by
 * supabase/migrations/0021_outreach.sql, which prevails over the spec.
 * Pure types: safe to import from client components.
 */

export type Direction = "sortant" | "entrant";
export type AddressForm = "tu" | "vous";
export type StageRole =
  | "a_valider" | "planifie" | "attente" | "relance" | "nouveau"
  | "conversation" | "resolu" | "succes" | "clos";
export type ClosedReason =
  | "refus" | "ne_plus_ecrire" | "rebond" | "sans_suite"
  | "abandonne" | "doublon" | "resolu" | "sans_reponse";
export type OutreachActor = "leo" | "cron" | "ia" | "lien" | "imap" | "ingest";

export type NeedsLeoReason =
  | "zone_rouge" | "confiance" | "sujet_non_auto" | "auto_coupe" | "limite_auto"
  | "hors_corpus" | "refus" | "lien_correction" | "photos_recues" | "justificatif_recu"
  | "rattachement_incertain" | "tri_incertain" | "sla_depasse" | "adresse_non_verifiee"
  | "contexte_absent" | "ia_indisponible" | "ia_invalide" | "envoi_bloque" | "autre";

export type SendStatus = "a_valider" | "planifie" | "en_cours" | "envoye" | "echec" | "annule";
export type MessageKind =
  | "initial" | "relance" | "reponse" | "hors_admin"
  | "entrant" | "entrant_auto" | "rebond" | "plainte" | "lien" | "formulaire";

export interface Stage {
  program_id: string;
  slug: string;
  label: string;
  role: StageRole;
  position: number;
  on_board: boolean;
}

export interface Transition {
  program_id: string;
  from_slug: string;
  to_slug: string;
  actors: OutreachActor[];
  note: string | null;
}

export interface ProgramSettings {
  program_id: string;
  paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  auto_send_enabled: boolean;
  confidence_threshold: number;
  auto_streak_limit: number;
  auto_reply_delay_min: number;
  auto_min_reviewed: number;
  edited_threshold: number;
  daily_cap: number;
  ramp_started_on: string | null;
  ramp_steps: number[];
  per_run_cap: number;
  send_days: number[];
  send_start: string;
  send_end: string;
  timezone: string;
  follow_up_after_days: number;
  max_follow_ups: number;
  close_after_days: number;
  min_days_between_threads: number;
  sla_first_response_hours: number;
  resolved_autoclose_days: number;
  link_ttl_days: number;
  retention_months: number;
  updated_at: string;
  updated_by: string | null;
}

export interface Program {
  id: string;
  slug: string;
  label: string;
  description: string;
  direction: Direction;
  mailbox_key: string;
  active: boolean;
  sender_name: string;
  address_form: AddressForm;
  signature: string;
  entry_sources: string[];
  link_actions: string[];
  uses_articles: boolean;
  created_at: string;
  updated_at: string;
}

/** A program with everything the engine reads about it. */
export interface ProgramConfig extends Program {
  stages: Stage[];
  transitions: Transition[];
  settings: ProgramSettings | null;
}

export interface Mailbox {
  key: string;
  label: string;
  address: string;
  env_prefix: string;
  personal: boolean;
  active: boolean;
  paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  hard_daily_cap: number;
  health_window_days: number;
  bounce_threshold: number;
  bounce_min_count: number;
  complaint_threshold: number;
  triage_threshold: number;
  fallback_program_id: string | null;
}

export interface ProgramContext {
  id: string;
  program_id: string;
  version: number;
  body: string;
  active: boolean;
  written_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  change_note: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  program_id: string;
  slug: string;
  label: string;
  description: string | null;
  zone_rouge: boolean;
  auto_enabled: boolean;
  auto_enabled_at: string | null;
  position: number;
}

export interface RedZone {
  id: string;
  program_id: string | null;
  code: string;
  label: string;
  description: string;
  position: number;
}

export interface Article {
  id: string;
  source: string;
  slug: string;
  lang: string;
  title: string;
  url: string;
  published_at: string | null;
}

export interface Contact {
  id: string;
  name: string;
  kind: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  organization_id: string | null;
  establishment_id: string | null;
  annuaire_lieu_id: string | null;
  sejour_place_slug: string | null;
  sejour_place_id: string | null;
  sejour_user_id: string | null;
  basis: string;
  do_not_contact: boolean;
  do_not_contact_at: string | null;
  do_not_contact_source: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  contact_id: string;
  email: string;
  person_first_name: string | null;
  person_name: string | null;
  person_role: string | null;
  is_role_address: boolean;
  is_primary: boolean;
  source: string;
  source_url: string | null;
  source_note: string | null;
  collected_at: string;
  verified_at: string | null;
  status: "valide" | "rebond_temporaire" | "invalide" | "opt_out";
  soft_bounces: number;
}

export interface Thread {
  id: string;
  program_id: string;
  contact_id: string;
  address_id: string | null;
  article_id: string | null;
  initial_subject_id: string | null;
  current_subject_id: string | null;
  email_subject: string;
  status: string;
  closed_reason: ClosedReason | null;
  status_changed_at: string;
  needs_leo: boolean;
  needs_leo_reason: NeedsLeoReason | null;
  needs_leo_since: string | null;
  auto_streak: number;
  follow_up_count: number;
  first_sent_at: string | null;
  last_outbound_at: string | null;
  first_inbound_at: string | null;
  last_inbound_at: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  photos_granted_at: string | null;
  correction_requested_at: string | null;
  opted_out_at: string | null;
  lot_id: string | null;
  template_id: string | null;
  personal_line: string | null;
  is_custom: boolean;
  article_context: Record<string, unknown>;
  external_type: string | null;
  external_id: string | null;
  triage_confidence: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  name?: string;
  filename?: string;
  size?: number;
  type?: string;
  content_type?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  direction: "in" | "out";
  kind: MessageKind;
  message_id: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_reply: string | null;
  attachments: Attachment[];
  received_at: string | null;
  match_method: string | null;
  send_status: SendStatus | null;
  author: "leo" | "auto" | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  send_error: string | null;
  draft_text: string | null;
  draft_source: string | null;
  modified_by_leo: boolean | null;
  add_to_knowledge: boolean;
  ai_subject_id: string | null;
  ai_intent: string | null;
  ai_confidence: number | null;
  ai_zone_rouge: boolean | null;
  ai_red_zones: string[];
  ai_sources: string[];
  ai_opt_out: boolean | null;
  ai_summary: string | null;
  ai_draft: string | null;
  ai_decision: "auto" | "a_toi" | "ignore" | null;
  ai_decision_reasons: string[];
  ai_context_version: number | null;
  ai_triage_program_id: string | null;
  ai_triage_confidence: number | null;
  ai_model: string | null;
  ai_error: string | null;
  classified_at: string | null;
  created_at: string;
}

export interface PhotoGrant {
  id: string;
  thread_id: string;
  contact_id: string;
  licence: string;
  credit: string;
  granted_by_name: string;
  scope: string;
  files: { path?: string; name?: string }[];
  accepted_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface OutreachEvent {
  id: number;
  occurred_at: string;
  program_id: string | null;
  thread_id: string | null;
  contact_id: string | null;
  message_id: string | null;
  actor: string;
  type: string;
  data: Record<string, unknown>;
}

// ---- Monitoring views (0021, section H) --------------------------------

export interface ProgramStatsRow {
  program_id: string;
  slug: string;
  label: string;
  direction: Direction;
  mailbox_key: string;
  active: boolean;
  fils: number;
  actifs: number;
  a_toi: number;
  clos: number;
  succes: number;
  contactes: number;
  ont_repondu: number;
  taux_reponse_pct: number | null;
  hors_delai: number;
  premiere_reponse_h_mediane: number | null;
}

export interface ArticleStatsRow {
  program_id: string;
  article_id: string;
  slug: string;
  lang: string;
  title: string;
  url: string;
  fils: number;
  a_valider: number;
  contactes: number;
  ont_repondu: number;
  partenaires: number;
  photos: number;
  ne_plus_ecrire: number;
  rebonds: number;
  sans_suite: number;
  taux_reponse_pct: number | null;
}

export interface WeeklyRow {
  program_id: string | null;
  semaine: string;
  premiers_contacts: number;
  relances: number;
  reponses_leo: number;
  reponses_auto: number;
  fils_ouverts: number;
  messages_recus: number;
  rebonds: number;
  plaintes: number;
  desinscriptions: number;
  actions_lien: number;
}

export interface SubjectQualityRow {
  program_id: string;
  program_slug: string;
  subject_id: string;
  slug: string;
  label: string;
  zone_rouge: boolean;
  auto_enabled: boolean;
  recus: number;
  decisions_auto: number;
  decisions_a_toi: number;
  confiance_moyenne: number | null;
  relues_par_leo: number;
  envoyees_auto: number;
  part_modifiee_20_dernieres: number | null;
}

export interface MailboxHealthRow {
  mailbox_key: string;
  address: string;
  active: boolean;
  paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  hard_daily_cap: number;
  envois_froids: number;
  envois: number;
  rebonds: number;
  plaintes: number;
  desinscriptions: number;
  taux_rebond: number | null;
  taux_plainte: number | null;
  envois_aujourdhui: number;
  froids_aujourdhui: number;
  file_attente: number;
  envois_bloques: number;
}

// ---- Screen models --------------------------------------------------------

export interface ThreadListItem extends Thread {
  contact_name: string;
  contact_city: string | null;
  program_slug: string;
  program_label: string;
  stage_label: string;
  stage_role: StageRole | null;
  subject_label: string | null;
  article_title: string | null;
  ai_summary: string | null;
}

export type AlertLevel = "danger" | "warn" | "info";
export interface OverviewAlert {
  level: AlertLevel;
  text: string;
  href?: string;
}

/** Result shape shared by every server action. */
export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export const NEEDS_LEO_LABELS: Record<NeedsLeoReason, string> = {
  zone_rouge: "Zone rouge",
  confiance: "Confiance trop basse",
  sujet_non_auto: "Sujet non automatique",
  auto_coupe: "Automatique coupé",
  limite_auto: "Limite d'affilée atteinte",
  hors_corpus: "Hors base de connaissances",
  refus: "Refus à confirmer",
  lien_correction: "Correction demandée",
  photos_recues: "Photos reçues",
  justificatif_recu: "Justificatif reçu",
  rattachement_incertain: "Rattachement incertain",
  tri_incertain: "Programme incertain",
  sla_depasse: "Délai de réponse dépassé",
  adresse_non_verifiee: "Adresse non vérifiée",
  contexte_absent: "Contexte absent",
  ia_indisponible: "IA indisponible",
  ia_invalide: "Lecture IA invalide",
  envoi_bloque: "Envoi bloqué",
  autre: "Autre",
};

export const CLOSED_REASON_LABELS: Record<ClosedReason, string> = {
  refus: "Refus",
  ne_plus_ecrire: "Ne plus écrire",
  rebond: "Adresse en rebond",
  sans_suite: "Sans suite",
  abandonne: "Abandonné",
  doublon: "Doublon",
  resolu: "Résolu",
  sans_reponse: "Sans réponse",
};

export const ADDRESS_SOURCE_LABELS: Record<string, string> = {
  site_web: "Site web du lieu",
  annuaire: "Annuaire",
  organisation_admin: "Organisation (admin)",
  sejour: "sejour.casaminga.com",
  recommandation: "Recommandation",
  mail_entrant: "Mail reçu",
  formulaire: "Formulaire",
  leo: "Saisie par Léo",
  autre: "Autre",
};
