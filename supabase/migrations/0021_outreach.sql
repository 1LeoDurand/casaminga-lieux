-- 0021_outreach
--
-- Contacts module of the admin (/admin/contacts): one generic engine for
-- email conversations (threads, messages, AI reading, signed links,
-- monitoring) driven by PROGRAMS. A program is one kind of exchange:
-- outbound (we write first, e.g. places cited in a sejour.casaminga.com
-- article) or inbound (a mail or a form opens the thread, e.g. sejour
-- support, claim of an imported listing). Each program sets its mailbox,
-- sender identity, AI context, pipeline stages, subjects, red zones, signed
-- link actions, delays, automation settings and entry sources. Shared by
-- all programs: the contact record, the suppression list, the signed link
-- mechanism, universal red zones, monitoring.
--
-- Spec: docs/SPEC_CONTACTS_2026-09-29.md.
--
-- Access model, same as platform_tasks (0009) and annuaire_sites_sondes (0019):
--   * RLS enabled WITHOUT any policy on every outreach_* table;
--   * explicit REVOKE ALL from anon and authenticated on tables, views and
--     the sequence. Checked on 2026-09-29 in pg_default_acl: since 0018 new
--     functions get nothing, but new tables and views still get
--     SELECT/INSERT/UPDATE/DELETE for anon and authenticated, and sequences
--     USAGE/SELECT/UPDATE. RLS without a policy already blocks every row;
--     the REVOKE removes the nominal right.
--   * the admin reads and writes with the service role client, after
--     requireSuperAdmin() (src/lib/admin/guard.ts). Public pages (signed
--     links, inbound form route) also use the service role, server side,
--     after their own checks. Nothing here is readable with the anon key.
--
-- Why no policy based on is_super_admin(): the app decides who is a platform
-- admin from SUPER_ADMIN_EMAILS (guard.ts), the database from
-- profiles.role = 'super_admin'. A policy would add a second door.
--
-- Safety rules are enforced twice: in src/lib/outreach and here (guard,
-- stage and activation triggers). A bug in the app raises an exception
-- instead of sending an email to someone who asked us to stop.
--
-- Programs are seeded INACTIVE. A program can only be activated once
-- outreach_program_ready() returns an empty array (active reviewed context,
-- settings, subjects including 'autre', complete stages).
--
-- Consequences for callers:
--   * anon and authenticated get "permission denied" on every outreach_*
--     table, view and function: session clients (supabase-js with the anon
--     key or a user session) cannot read this module at all. Only the
--     service role client, server side, can.
--   * outreach_ingest_batch() and outreach_open_inbound() refuse an inactive
--     program (22023): nothing can be ingested before a program has an
--     active reviewed context and has been activated.
--   * The guard trigger on outreach_messages raises P0001 ("outreach guard:
--     ...") when a message is set to 'planifie' or 'en_cours' against the
--     rules; the sending code must catch it and flag the thread, never retry
--     around it.
--   * Stage changes of a thread are checked against
--     outreach_program_transitions; an RPC may state its actor with
--     set_config('outreach.actor', '<actor>', true).
--
-- Review before applying (2026-09-29): the journal trigger lets through the
-- UPDATE issued by ON DELETE SET NULL (program_id, message_id) and nothing
-- else; the guard fails closed when the program, its settings or its
-- mailbox cannot be read; a contact is matched by name only together with
-- a city; foreign keys get covering indexes.
--
-- Applied on 2026-09-29 through the Supabase connector, with Leo's agreement.

begin;

-- =====================================================================
-- A. Mailboxes and programs
-- =====================================================================

create table if not exists public.outreach_mailboxes (
  key                  text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  label                text not null,
  address              text not null unique check (
                         address = lower(btrim(address))
                         and address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Prefix of this mailbox's .env variables: <PREFIX>SMTP_HOST, <PREFIX>IMAP_USER...
  env_prefix           text not null unique check (env_prefix ~ '^[A-Z][A-Z0-9_]*_$'),
  -- Personal mailbox (leo@): a mail that matches no thread is never stored.
  personal             boolean not null default false,
  active               boolean not null default false,
  paused               boolean not null default false,
  pause_reason         text,
  paused_at            timestamptz,
  -- Health and caps are judged per mailbox: reputation belongs to the address.
  hard_daily_cap       int not null default 80 check (hard_daily_cap between 0 and 1000),
  health_window_days   int not null default 14 check (health_window_days between 1 and 90),
  bounce_threshold     numeric(5,4) not null default 0.0200,
  bounce_min_count     int not null default 3 check (bounce_min_count >= 1),
  complaint_threshold  numeric(5,4) not null default 0.0010,
  -- Shared mailbox: AI triage decides the program of a new mail.
  triage_threshold     numeric(3,2) not null default 0.80 check (triage_threshold between 0.50 and 0.99),
  -- Where an uncertain new mail lands (inbound program of this mailbox).
  fallback_program_id  uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint outreach_mailboxes_pause_reason check (not paused or pause_reason is not null)
);

create table if not exists public.outreach_programs (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  label          text not null,
  -- One paragraph. Shown in the admin and given to the triage prompt.
  description    text not null,
  direction      text not null check (direction in ('sortant', 'entrant')),
  mailbox_key    text not null references public.outreach_mailboxes(key),
  active         boolean not null default false,

  -- Sender identity
  sender_name    text not null check (length(btrim(sender_name)) between 2 and 80),
  address_form   text not null check (address_form in ('tu', 'vous')),
  signature      text not null check (length(signature) between 2 and 500),

  -- Entry points and signed link actions
  entry_sources  text[] not null check (
                   cardinality(entry_sources) >= 1
                   and entry_sources <@ array['skill', 'formulaire', 'admin', 'mail']::text[]),
  link_actions   text[] not null default '{}' check (
                   link_actions <@ array['photos', 'correction', 'stop', 'resolu', 'justificatif']::text[]),
  -- Threads of this program carry an article (outreach_articles).
  uses_articles  boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Cold mail always offers a one-click opt-out.
  constraint outreach_programs_outbound_stop check (direction <> 'sortant' or 'stop' = any(link_actions)),
  constraint outreach_programs_sources_direction check (
    (direction = 'sortant' and entry_sources <@ array['skill', 'admin']::text[])
    or (direction = 'entrant' and entry_sources <@ array['formulaire', 'admin', 'mail']::text[]))
);

create index if not exists outreach_programs_mailbox_idx on public.outreach_programs (mailbox_key);

alter table public.outreach_mailboxes
  drop constraint if exists outreach_mailboxes_fallback_fk;
alter table public.outreach_mailboxes
  add constraint outreach_mailboxes_fallback_fk
  foreign key (fallback_program_id) references public.outreach_programs(id) on delete set null;

-- AI context of a program: French text written and reviewed by Leo.
-- Immutable once written (trigger); a change is a new version.
create table if not exists public.outreach_program_contexts (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.outreach_programs(id) on delete cascade,
  version      int not null check (version >= 1),
  body         text not null check (length(body) between 200 and 20000),
  active       boolean not null default false,
  written_by   text not null default 'leo',
  reviewed_by  text,
  reviewed_at  timestamptz,
  change_note  text,
  created_at   timestamptz not null default now(),
  unique (program_id, version),
  constraint outreach_program_contexts_active_reviewed check (not active or reviewed_at is not null)
);

create unique index if not exists outreach_program_contexts_one_active_uidx
  on public.outreach_program_contexts (program_id) where active;

-- Pipeline of a program. The engine only knows ROLES; slugs and labels are
-- the program's. One stage per role at most.
create table if not exists public.outreach_program_stages (
  program_id  uuid not null references public.outreach_programs(id) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9_]{2,30}$'),
  label       text not null,
  role        text not null check (role in ('a_valider', 'planifie', 'attente', 'relance',
                                            'nouveau', 'conversation', 'resolu', 'succes', 'clos')),
  position    int not null,
  on_board    boolean not null default true,
  primary key (program_id, slug),
  unique (program_id, role)
);

create table if not exists public.outreach_program_transitions (
  program_id  uuid not null,
  from_slug   text not null,
  to_slug     text not null,
  actors      text[] not null check (
                cardinality(actors) >= 1
                and actors <@ array['leo', 'cron', 'ia', 'lien', 'imap', 'ingest']::text[]),
  note        text,
  primary key (program_id, from_slug, to_slug),
  foreign key (program_id, from_slug)
    references public.outreach_program_stages(program_id, slug) on delete cascade,
  foreign key (program_id, to_slug)
    references public.outreach_program_stages(program_id, slug) on delete cascade,
  check (from_slug <> to_slug)
);

-- Operational settings, one row per program.
create table if not exists public.outreach_settings (
  program_id                uuid primary key references public.outreach_programs(id) on delete cascade,

  paused                    boolean not null default false,
  pause_reason              text,
  paused_at                 timestamptz,

  -- Automation
  auto_send_enabled         boolean not null default false,
  confidence_threshold      numeric(3,2) not null default 0.85 check (confidence_threshold between 0.50 and 0.99),
  auto_streak_limit         int not null default 3 check (auto_streak_limit between 0 and 10),
  auto_reply_delay_min      int not null default 30 check (auto_reply_delay_min between 0 and 1440),
  auto_min_reviewed         int not null default 20 check (auto_min_reviewed between 5 and 200),
  edited_threshold          numeric(5,4) not null default 0.3000,

  -- Pace (cold mail of outbound programs; ignored by inbound programs)
  daily_cap                 int not null default 30 check (daily_cap between 0 and 500),
  ramp_started_on           date,
  ramp_steps                int[] not null default '{5,10,20,30}',
  per_run_cap               int not null default 2 check (per_run_cap between 1 and 20),

  -- Sending window (all programs)
  send_days                 int[] not null default '{1,2,3,4,5}',
  send_start                time not null default '09:00',
  send_end                  time not null default '17:30',
  timezone                  text not null default 'Europe/Paris',

  -- Delays
  follow_up_after_days      int not null default 10 check (follow_up_after_days between 3 and 30),
  max_follow_ups            int not null default 1 check (max_follow_ups between 0 and 1),
  close_after_days          int not null default 30 check (close_after_days between 7 and 120),
  min_days_between_threads  int not null default 60 check (min_days_between_threads between 0 and 365),
  sla_first_response_hours  int not null default 48 check (sla_first_response_hours between 1 and 720),
  resolved_autoclose_days   int not null default 7 check (resolved_autoclose_days between 1 and 60),

  -- Signed links and retention
  link_ttl_days             int not null default 120 check (link_ttl_days between 7 and 365),
  retention_months          int not null default 36 check (retention_months between 1 and 120),

  updated_at                timestamptz not null default now(),
  updated_by                text,

  constraint outreach_settings_window check (send_start < send_end),
  constraint outreach_settings_days check (send_days <@ array[1, 2, 3, 4, 5, 6, 7]),
  constraint outreach_settings_pause_reason check (not paused or pause_reason is not null)
);

create table if not exists public.outreach_subjects (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.outreach_programs(id) on delete cascade,
  slug             text not null check (slug ~ '^[a-z0-9_]{2,40}$'),
  label            text not null,
  description      text,
  zone_rouge       boolean not null default false,
  auto_enabled     boolean not null default false,
  auto_enabled_at  timestamptz,
  auto_enabled_by  text,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (program_id, slug),
  -- Target of the composite foreign keys of outreach_threads.
  unique (id, program_id),
  constraint outreach_subjects_red_never_auto check (not (zone_rouge and auto_enabled))
);

-- program_id null = universal red zone, applies to every program.
create table if not exists public.outreach_red_zones (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid references public.outreach_programs(id) on delete cascade,
  code         text not null check (code ~ '^[a-z_]{3,40}$'),
  label        text not null,
  description  text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create unique index if not exists outreach_red_zones_code_uidx
  on public.outreach_red_zones ((coalesce(program_id::text, '*')), code);

-- =====================================================================
-- B. Contacts, addresses, articles (shared by all programs)
-- =====================================================================

create table if not exists public.outreach_articles (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'sejour' check (source in ('sejour', 'casaminga', 'autre')),
  slug          text not null,
  lang          text not null default 'fr',
  title         text not null,
  url           text not null check (url ~ '^https://'),
  published_at  date,
  created_at    timestamptz not null default now(),
  unique (source, slug, lang)
);

create table if not exists public.outreach_contacts (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(btrim(name)) between 2 and 200),
  kind                   text check (kind in ('habitat_participatif', 'ecolieu', 'tiers_lieu',
                                              'association', 'reseau', 'personne', 'autre')),
  website                text,
  city                   text,
  region                 text,

  -- Same database: real foreign keys.
  organization_id        uuid references public.organizations(id) on delete set null,
  establishment_id       uuid references public.establishments(id) on delete set null,
  annuaire_lieu_id       uuid references public.annuaire_lieux(id) on delete set null,
  -- sejour lives in another Supabase project (giekhaohqksirsadkfnt): text only.
  sejour_place_slug      text,
  sejour_place_id        text,
  sejour_user_id         text,

  basis                  text not null default 'prospection_b2b'
                         check (basis in ('prospection_b2b', 'demande_entrante', 'consentement', 'relation_existante')),

  -- "Do not write to us any more": no unsolicited nor automatic mail, any program.
  do_not_contact         boolean not null default false,
  do_not_contact_at      timestamptz,
  do_not_contact_source  text check (do_not_contact_source in ('lien', 'list_unsubscribe', 'reponse', 'leo', 'plainte')),

  tags                   text[] not null default '{}',
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint outreach_contacts_dnc_dated check (not do_not_contact or do_not_contact_at is not null)
);

create unique index if not exists outreach_contacts_sejour_slug_uidx
  on public.outreach_contacts (sejour_place_slug) where sejour_place_slug is not null;
create unique index if not exists outreach_contacts_annuaire_uidx
  on public.outreach_contacts (annuaire_lieu_id) where annuaire_lieu_id is not null;
create index if not exists outreach_contacts_org_idx
  on public.outreach_contacts (organization_id) where organization_id is not null;
create index if not exists outreach_contacts_sejour_user_idx
  on public.outreach_contacts (sejour_user_id) where sejour_user_id is not null;
create index if not exists outreach_contacts_name_idx on public.outreach_contacts (lower(name));
create index if not exists outreach_contacts_region_idx on public.outreach_contacts (region);

create table if not exists public.outreach_addresses (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.outreach_contacts(id) on delete cascade,
  email              text not null check (
                       email = lower(btrim(email))
                       and length(email) <= 254
                       and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  person_first_name  text,
  person_name        text,
  person_role        text,
  is_role_address    boolean not null default false,
  is_primary         boolean not null default false,
  -- Where the address comes from: what we answer to "how did you get my address?".
  source             text not null check (source in ('site_web', 'annuaire', 'organisation_admin', 'sejour',
                                                     'recommandation', 'mail_entrant', 'formulaire', 'leo', 'autre')),
  source_url         text,
  source_note        text,
  collected_at       timestamptz not null default now(),
  -- The person wrote to us from this address (proof that it is theirs).
  verified_at        timestamptz,
  status             text not null default 'valide'
                     check (status in ('valide', 'rebond_temporaire', 'invalide', 'opt_out')),
  soft_bounces       int not null default 0 check (soft_bounces >= 0),
  status_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (contact_id, email)
);

create unique index if not exists outreach_addresses_one_primary_uidx
  on public.outreach_addresses (contact_id) where is_primary;
create index if not exists outreach_addresses_email_idx on public.outreach_addresses (email);

-- =====================================================================
-- C. Threads and messages
-- =====================================================================

create table if not exists public.outreach_threads (
  id                       uuid primary key default gen_random_uuid(),
  program_id               uuid not null references public.outreach_programs(id),
  contact_id               uuid not null references public.outreach_contacts(id) on delete cascade,
  address_id               uuid references public.outreach_addresses(id) on delete set null,
  article_id               uuid references public.outreach_articles(id) on delete set null,

  initial_subject_id       uuid,
  current_subject_id       uuid,
  email_subject            text not null check (length(email_subject) between 3 and 200),

  -- Stage slug of the program (composite FK below).
  status                   text not null,
  closed_reason            text check (closed_reason in ('refus', 'ne_plus_ecrire', 'rebond', 'sans_suite',
                                                         'abandonne', 'doublon', 'resolu', 'sans_reponse')),
  status_changed_at        timestamptz not null default now(),

  needs_leo                boolean not null default false,
  needs_leo_reason         text check (needs_leo_reason in (
                             'zone_rouge', 'confiance', 'sujet_non_auto', 'auto_coupe', 'limite_auto',
                             'hors_corpus', 'refus', 'lien_correction', 'photos_recues', 'justificatif_recu',
                             'rattachement_incertain', 'tri_incertain', 'sla_depasse', 'adresse_non_verifiee',
                             'contexte_absent', 'ia_indisponible', 'ia_invalide', 'envoi_bloque', 'autre')),
  needs_leo_since          timestamptz,

  auto_streak              int not null default 0 check (auto_streak >= 0),
  follow_up_count          int not null default 0 check (follow_up_count between 0 and 1),

  first_sent_at            timestamptz,
  last_outbound_at         timestamptz,
  first_inbound_at         timestamptz,
  -- Human replies only (auto-replies and bounces do not count).
  last_inbound_at          timestamptz,
  first_response_at        timestamptz,
  sla_due_at               timestamptz,
  resolved_at              timestamptz,
  photos_granted_at        timestamptz,
  correction_requested_at  timestamptz,
  opted_out_at             timestamptz,
  -- Signed links of this thread stop working (except the opt-out).
  link_revoked_at          timestamptz,

  -- Batch validation and template (outbound programs).
  lot_id                   uuid,
  template_id              text,
  personal_line            text,
  is_custom                boolean not null default false,
  article_context          jsonb not null default '{}'::jsonb,

  -- Object of another admin module (claim, ticket...), without FK: the
  -- other module stays the owner and the source of truth.
  external_type            text check (external_type in ('claim', 'ticket', 'booking', 'bug', 'account', 'autre')),
  external_id              text,

  -- AI triage of a new mail in a shared mailbox.
  triage_confidence        numeric(3,2) check (triage_confidence between 0 and 1),

  created_by               text not null default 'ingest' check (created_by in ('ingest', 'leo', 'imap', 'formulaire')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  foreign key (program_id, status)
    references public.outreach_program_stages(program_id, slug),
  foreign key (initial_subject_id, program_id)
    references public.outreach_subjects(id, program_id),
  foreign key (current_subject_id, program_id)
    references public.outreach_subjects(id, program_id),
  constraint outreach_threads_needs_leo_reason check (not needs_leo or needs_leo_reason is not null),
  constraint outreach_threads_external check ((external_type is null) = (external_id is null))
);

create unique index if not exists outreach_threads_article_uidx
  on public.outreach_threads (program_id, contact_id, article_id, initial_subject_id)
  where article_id is not null;
create index if not exists outreach_threads_program_status_idx
  on public.outreach_threads (program_id, status, status_changed_at desc);
create index if not exists outreach_threads_a_toi_idx
  on public.outreach_threads (program_id, needs_leo_reason, needs_leo_since) where needs_leo;
create index if not exists outreach_threads_sla_idx
  on public.outreach_threads (sla_due_at) where sla_due_at is not null and first_response_at is null;
create index if not exists outreach_threads_contact_idx on public.outreach_threads (contact_id);
create index if not exists outreach_threads_article_idx on public.outreach_threads (article_id);
create index if not exists outreach_threads_external_idx
  on public.outreach_threads (external_type, external_id) where external_id is not null;
create index if not exists outreach_threads_lot_idx on public.outreach_threads (lot_id) where lot_id is not null;

create table if not exists public.outreach_messages (
  id                    uuid primary key default gen_random_uuid(),
  thread_id             uuid not null references public.outreach_threads(id) on delete cascade,
  direction             text not null check (direction in ('out', 'in')),
  kind                  text not null check (kind in (
                          'initial', 'relance', 'reponse', 'hors_admin',                      -- out
                          'entrant', 'entrant_auto', 'rebond', 'plainte', 'lien', 'formulaire')), -- in

  -- Headers, without angle brackets.
  message_id            text,
  in_reply_to           text,
  references_ids        text[] not null default '{}',
  reply_to_message_id   uuid references public.outreach_messages(id) on delete set null,
  from_email            text,
  to_email              text,
  cc_emails             text[] not null default '{}',
  subject               text,

  -- out: body_text = final text (without links block and signature, added at
  -- compose time). in: full plain text; body_reply = reply without the quote.
  body_text             text,
  body_reply            text,
  attachments           jsonb not null default '[]'::jsonb,

  imap_folder           text,
  imap_uid              bigint,
  received_at           timestamptz,
  match_method          text check (match_method in ('in_reply_to', 'references', 'adresse_sujet', 'adresse',
                                                     'nouveau_fil', 'lien', 'formulaire', 'admin', 'leo')),

  -- Sending (out only)
  send_status           text check (send_status in ('a_valider', 'planifie', 'en_cours', 'envoye', 'echec', 'annule')),
  author                text check (author in ('leo', 'auto')),
  approved_by           text,
  approved_at           timestamptz,
  scheduled_for         timestamptz,
  send_attempts         int not null default 0 check (send_attempts between 0 and 10),
  sent_at               timestamptz,
  smtp_response         text,
  send_error            text,
  appended_to_sent      boolean not null default false,

  -- Drafts
  draft_text            text,
  draft_source          text check (draft_source in ('ingest', 'ia', 'leo')),
  modified_by_leo       boolean,
  edit_ratio            numeric(4,3) check (edit_ratio between 0 and 1),
  add_to_knowledge      boolean not null default false,

  -- AI reading (in only)
  ai_subject_id         uuid references public.outreach_subjects(id) on delete set null,
  ai_intent             text,
  ai_confidence         numeric(3,2) check (ai_confidence between 0 and 1),
  ai_zone_rouge         boolean,
  ai_red_zones          text[] not null default '{}',
  ai_sources            uuid[] not null default '{}',
  ai_opt_out            boolean,
  ai_summary            text,
  ai_draft              text,
  ai_decision           text check (ai_decision in ('auto', 'a_toi', 'ignore')),
  ai_decision_reasons   text[] not null default '{}',
  ai_context_version    int,
  ai_prompt_version     text,
  ai_triage_program_id  uuid references public.outreach_programs(id) on delete set null,
  ai_triage_confidence  numeric(3,2) check (ai_triage_confidence between 0 and 1),
  ai_model              text,
  ai_input_tokens       int,
  ai_output_tokens      int,
  ai_attempts           int not null default 0 check (ai_attempts between 0 and 10),
  ai_error              text,
  classified_at         timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint outreach_messages_out_has_status check ((direction = 'out') = (send_status is not null)),
  constraint outreach_messages_out_has_author check ((direction = 'out') = (author is not null)),
  constraint outreach_messages_kind_direction check (
    (direction = 'out' and kind in ('initial', 'relance', 'reponse', 'hors_admin'))
    or (direction = 'in' and kind in ('entrant', 'entrant_auto', 'rebond', 'plainte', 'lien', 'formulaire'))),
  -- Never an automatic first contact or follow-up.
  constraint outreach_messages_auto_is_reply check (
    author is distinct from 'auto' or (kind = 'reponse' and reply_to_message_id is not null)),
  constraint outreach_messages_ai_on_inbound check (direction = 'in' or ai_decision is null)
);

create unique index if not exists outreach_messages_message_id_uidx
  on public.outreach_messages (message_id) where message_id is not null;
create index if not exists outreach_messages_thread_idx on public.outreach_messages (thread_id, created_at);
create index if not exists outreach_messages_queue_idx
  on public.outreach_messages (scheduled_for) where send_status = 'planifie';
create index if not exists outreach_messages_inflight_idx
  on public.outreach_messages (updated_at) where send_status = 'en_cours';
create index if not exists outreach_messages_unclassified_idx
  on public.outreach_messages (created_at)
  where direction = 'in' and kind in ('entrant', 'formulaire') and classified_at is null;
create index if not exists outreach_messages_subject_idx
  on public.outreach_messages (ai_subject_id, created_at desc) where direction = 'in';
create index if not exists outreach_messages_imap_idx
  on public.outreach_messages (imap_folder, imap_uid) where imap_uid is not null;
create index if not exists outreach_messages_unappended_idx
  on public.outreach_messages (sent_at) where send_status = 'envoye' and not appended_to_sent;

-- =====================================================================
-- D. Photo grants, suppressions, events, knowledge, IMAP state
-- =====================================================================

create table if not exists public.outreach_photo_grants (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references public.outreach_threads(id) on delete restrict,
  contact_id       uuid not null references public.outreach_contacts(id) on delete restrict,
  licence          text not null check (licence in ('CC-BY-4.0', 'CC-BY-SA-4.0')),
  credit           text not null check (length(btrim(credit)) between 2 and 200),
  granted_by_name  text not null check (length(btrim(granted_by_name)) between 2 and 200),
  granted_by_role  text,
  scope            text not null check (scope in ('photos_article', 'photos_deposees', 'les_deux')),
  photo_refs       jsonb not null default '[]'::jsonb,
  files            jsonb not null default '[]'::jsonb,
  consent_text     text not null,
  consent_version  text not null,
  consent_sha256   text not null check (consent_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at      timestamptz not null default now(),
  ip_hash          text,
  user_agent       text,
  revoked_at       timestamptz,
  revoked_reason   text,
  created_at       timestamptz not null default now()
);

create index if not exists outreach_photo_grants_thread_idx on public.outreach_photo_grants (thread_id);

-- Shared by all programs. 'rebond' blocks everything; the other reasons
-- block unsolicited and automatic mail.
create table if not exists public.outreach_suppressions (
  email       text primary key check (email = lower(btrim(email))),
  reason      text not null check (reason in ('opt_out', 'rebond', 'plainte', 'leo')),
  source      text,
  thread_id   uuid references public.outreach_threads(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.outreach_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  program_id   uuid references public.outreach_programs(id) on delete set null,
  thread_id    uuid references public.outreach_threads(id) on delete cascade,
  contact_id   uuid references public.outreach_contacts(id) on delete cascade,
  message_id   uuid references public.outreach_messages(id) on delete set null,
  actor        text not null check (actor in ('leo', 'cron', 'ia', 'lien', 'imap', 'ingest', 'systeme')),
  type         text not null check (type ~ '^[a-z_]+\.[a-z_]+$' and length(type) <= 60),
  data         jsonb not null default '{}'::jsonb
);

create index if not exists outreach_events_program_idx on public.outreach_events (program_id, occurred_at desc);
create index if not exists outreach_events_thread_idx on public.outreach_events (thread_id, occurred_at desc);
create index if not exists outreach_events_type_idx on public.outreach_events (type, occurred_at desc);

create table if not exists public.outreach_knowledge (
  id                 uuid primary key default gen_random_uuid(),
  -- null = shared by every program.
  program_id         uuid references public.outreach_programs(id) on delete cascade,
  kind               text not null check (kind in ('page', 'corpus', 'approuvee', 'regle')),
  subject_id         uuid references public.outreach_subjects(id) on delete set null,
  title              text not null check (length(btrim(title)) between 2 and 200),
  -- For 'approuvee': the question rewritten without personal data.
  question           text,
  body               text not null check (length(body) between 1 and 8000),
  source_url         text,
  source_message_id  uuid references public.outreach_messages(id) on delete set null,
  active             boolean not null default true,
  reviewed_at        timestamptz,
  created_by         text not null default 'leo',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  fts                tsvector generated always as (
                       to_tsvector('french'::regconfig,
                         coalesce(title, '') || ' ' || coalesce(question, '') || ' ' || body)) stored
);

create index if not exists outreach_knowledge_fts_idx on public.outreach_knowledge using gin (fts);
create index if not exists outreach_knowledge_scope_idx
  on public.outreach_knowledge (program_id, subject_id, kind) where active;

create table if not exists public.outreach_mailbox_state (
  mailbox_key  text not null references public.outreach_mailboxes(key) on delete cascade,
  folder       text not null,
  uidvalidity  bigint not null,
  last_uid     bigint not null default 0 check (last_uid >= 0),
  last_run_at  timestamptz,
  last_error   text,
  primary key (mailbox_key, folder)
);

-- Covering indexes for the foreign keys not led by another index (deletes
-- on the parent and ON DELETE actions scan these columns).
create index if not exists outreach_mailboxes_fallback_idx on public.outreach_mailboxes (fallback_program_id);
create index if not exists outreach_program_transitions_to_idx on public.outreach_program_transitions (program_id, to_slug);
create index if not exists outreach_red_zones_program_idx on public.outreach_red_zones (program_id);
create index if not exists outreach_contacts_establishment_idx on public.outreach_contacts (establishment_id);
create index if not exists outreach_threads_address_idx on public.outreach_threads (address_id);
create index if not exists outreach_threads_initial_subject_idx on public.outreach_threads (initial_subject_id, program_id);
create index if not exists outreach_threads_current_subject_idx on public.outreach_threads (current_subject_id, program_id);
create index if not exists outreach_messages_reply_to_idx on public.outreach_messages (reply_to_message_id);
create index if not exists outreach_messages_triage_program_idx on public.outreach_messages (ai_triage_program_id);
create index if not exists outreach_photo_grants_contact_idx on public.outreach_photo_grants (contact_id);
create index if not exists outreach_suppressions_thread_idx on public.outreach_suppressions (thread_id);
create index if not exists outreach_events_contact_idx on public.outreach_events (contact_id);
create index if not exists outreach_events_message_idx on public.outreach_events (message_id);
create index if not exists outreach_knowledge_subject_idx on public.outreach_knowledge (subject_id);
create index if not exists outreach_knowledge_source_message_idx on public.outreach_knowledge (source_message_id);

-- =====================================================================
-- E. Triggers
-- =====================================================================

create or replace function public.outreach_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['outreach_mailboxes', 'outreach_programs', 'outreach_settings',
                           'outreach_subjects', 'outreach_contacts', 'outreach_addresses',
                           'outreach_threads', 'outreach_messages', 'outreach_knowledge']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I '
                   'for each row execute function public.outreach_touch()', t || '_touch', t);
  end loop;
end;
$$;

-- A context version is immutable: change it by creating a new version.
create or replace function public.outreach_contexts_freeze()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.body is distinct from old.body
     or new.version <> old.version
     or new.program_id <> old.program_id then
    raise exception 'outreach: a context version is immutable, create a new version'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_program_contexts_freeze on public.outreach_program_contexts;
create trigger outreach_program_contexts_freeze before update on public.outreach_program_contexts
  for each row execute function public.outreach_contexts_freeze();

-- What is missing before a program can be activated. Empty array = ready.
create or replace function public.outreach_program_ready(p_program uuid)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $$
  with p as (select * from public.outreach_programs where id = p_program)
  select array_remove(array[
    case when not exists (select 1 from p) then 'programme_inconnu' end,
    case when not exists (select 1 from public.outreach_program_contexts c
                          where c.program_id = p_program and c.active)
         then 'contexte_actif_manquant' end,
    case when not exists (select 1 from public.outreach_settings s where s.program_id = p_program)
         then 'reglages_manquants' end,
    case when not exists (select 1 from public.outreach_subjects su
                          where su.program_id = p_program and su.slug = 'autre' and su.zone_rouge)
         then 'sujet_autre_manquant' end,
    case when (select direction from p) = 'sortant'
          and (select count(*) from public.outreach_program_stages st
               where st.program_id = p_program
                 and st.role in ('a_valider', 'planifie', 'attente', 'conversation', 'clos')) < 5
         then 'etapes_sortant_incompletes' end,
    case when (select direction from p) = 'entrant'
          and (select count(*) from public.outreach_program_stages st
               where st.program_id = p_program
                 and st.role in ('nouveau', 'conversation', 'clos')) < 3
         then 'etapes_entrant_incompletes' end
  ], null);
$$;

create or replace function public.outreach_programs_activation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_missing text[];
begin
  if tg_op = 'UPDATE' and new.direction <> old.direction
     and exists (select 1 from public.outreach_threads t where t.program_id = new.id) then
    raise exception 'outreach: program % has threads, its direction cannot change', new.slug
      using errcode = '23514';
  end if;
  if new.active and (tg_op = 'INSERT' or not old.active) then
    v_missing := public.outreach_program_ready(new.id);
    if cardinality(v_missing) > 0 then
      raise exception 'outreach: program % is not ready: %', new.slug, array_to_string(v_missing, ', ')
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_programs_activation on public.outreach_programs;
create trigger outreach_programs_activation
  before insert or update of active, direction on public.outreach_programs
  for each row execute function public.outreach_programs_activation();

-- Stage rules of a thread: known stage, allowed transition, closed <=> reason,
-- program change only for re-routing after triage. Every change is journaled.
-- The app may state the actor with set_config('outreach.actor', 'leo', true)
-- inside an RPC; when it does, the actor must be allowed by the transition.
create or replace function public.outreach_threads_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_actor     text := coalesce(nullif(current_setting('outreach.actor', true), ''), 'systeme');
  v_role      text;
  v_old_role  text;
  v_actors    text[];
begin
  if v_actor not in ('leo', 'cron', 'ia', 'lien', 'imap', 'ingest', 'systeme') then
    v_actor := 'systeme';
  end if;

  select role into v_role from public.outreach_program_stages
  where program_id = new.program_id and slug = new.status;
  if v_role is null then
    raise exception 'outreach: stage % does not exist in this program', new.status using errcode = '23503';
  end if;
  if (v_role = 'clos') <> (new.closed_reason is not null) then
    raise exception 'outreach: a closed thread needs a reason, an open one has none' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.program_id <> old.program_id then
      select role into v_old_role from public.outreach_program_stages
      where program_id = old.program_id and slug = old.status;
      if v_old_role <> 'nouveau' or v_role <> 'nouveau'
         or (select direction from public.outreach_programs where id = new.program_id) <> 'entrant'
         or exists (select 1 from public.outreach_messages m
                    where m.thread_id = new.id and m.direction = 'out') then
        raise exception 'outreach: a thread changes program only at its entry stage, before any reply'
          using errcode = '23514';
      end if;
    elsif new.status is distinct from old.status then
      select actors into v_actors from public.outreach_program_transitions tr
      where tr.program_id = new.program_id and tr.from_slug = old.status and tr.to_slug = new.status;
      if v_actors is null then
        raise exception 'outreach: transition % -> % not allowed in this program', old.status, new.status
          using errcode = '23514';
      end if;
      if v_actor <> 'systeme' and not (v_actor = any(v_actors)) then
        raise exception 'outreach: % may not move a thread from % to %', v_actor, old.status, new.status
          using errcode = '42501';
      end if;
    end if;

    if new.status is distinct from old.status or new.program_id <> old.program_id then
      new.status_changed_at := now();
      insert into public.outreach_events (program_id, thread_id, contact_id, actor, type, data)
      values (new.program_id, new.id, new.contact_id, v_actor, 'status.changed',
              jsonb_build_object('from', old.status, 'to', new.status,
                                 'closed_reason', new.closed_reason,
                                 'program_changed', new.program_id <> old.program_id));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_threads_stage on public.outreach_threads;
create trigger outreach_threads_stage
  before insert or update of status, closed_reason, program_id on public.outreach_threads
  for each row execute function public.outreach_threads_stage();

-- Append-only journal: no UPDATE, no TRUNCATE. DELETE stays possible for the
-- retention purge (service role only). One exception: ON DELETE SET NULL on
-- program_id and message_id runs as an UPDATE of this table; an update that
-- only clears those references and changes nothing else is let through,
-- otherwise deleting a message or a program referenced here would fail.
create or replace function public.outreach_events_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id = old.id and new.occurred_at = old.occurred_at
       and new.actor = old.actor and new.type = old.type and new.data = old.data
       and new.thread_id is not distinct from old.thread_id
       and new.contact_id is not distinct from old.contact_id
       and (new.program_id is not distinct from old.program_id or new.program_id is null)
       and (new.message_id is not distinct from old.message_id or new.message_id is null) then
      return new;
    end if;
  end if;
  raise exception 'outreach_events is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists outreach_events_no_update on public.outreach_events;
create trigger outreach_events_no_update before update on public.outreach_events
  for each row execute function public.outreach_events_immutable();
drop trigger if exists outreach_events_no_truncate on public.outreach_events;
create trigger outreach_events_no_truncate before truncate on public.outreach_events
  for each statement execute function public.outreach_events_immutable();

-- Last line of defence before an email is queued or sent. Reads the rules
-- of the thread's program and mailbox.
create or replace function public.outreach_guard_outbound()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_thread       public.outreach_threads%rowtype;
  v_program      public.outreach_programs%rowtype;
  v_settings     public.outreach_settings%rowtype;
  v_mailbox      public.outreach_mailboxes%rowtype;
  v_contact      public.outreach_contacts%rowtype;
  v_role         text;
  v_email        text := lower(btrim(coalesce(new.to_email, '')));
  v_unsolicited  boolean := new.kind in ('initial', 'relance');
begin
  if new.direction <> 'out' or coalesce(new.send_status, '') not in ('planifie', 'en_cours') then
    return new;
  end if;

  select * into v_thread   from public.outreach_threads   where id = new.thread_id;
  select * into v_program  from public.outreach_programs  where id = v_thread.program_id;
  select * into v_settings from public.outreach_settings  where program_id = v_program.id;
  select * into v_mailbox  from public.outreach_mailboxes where key = v_program.mailbox_key;
  select * into v_contact  from public.outreach_contacts  where id = v_thread.contact_id;
  select role into v_role  from public.outreach_program_stages
  where program_id = v_thread.program_id and slug = v_thread.status;

  -- Fail closed: every rule below reads these rows, and a NULL would make
  -- an IF condition NULL, which lets the message through.
  if v_program.id is null or v_settings.program_id is null or v_mailbox.key is null
     or v_contact.id is null or v_role is null then
    raise exception 'outreach guard: program, settings, mailbox or stage missing' using errcode = 'P0001';
  end if;
  if v_email = '' then
    raise exception 'outreach guard: no recipient' using errcode = 'P0001';
  end if;
  if v_role = 'clos' then
    raise exception 'outreach guard: thread is closed' using errcode = 'P0001';
  end if;
  if not v_program.active or not v_mailbox.active then
    raise exception 'outreach guard: program or mailbox inactive' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.outreach_suppressions s where s.email = v_email and s.reason = 'rebond')
     or exists (select 1 from public.outreach_addresses a where a.email = v_email and a.status = 'invalide') then
    raise exception 'outreach guard: invalid address' using errcode = 'P0001';
  end if;
  if v_unsolicited or new.author = 'auto' then
    if v_contact.do_not_contact
       or exists (select 1 from public.outreach_suppressions s where s.email = v_email)
       or exists (select 1 from public.outreach_addresses a where a.email = v_email and a.status = 'opt_out') then
      raise exception 'outreach guard: recipient asked not to be contacted' using errcode = 'P0001';
    end if;
  end if;
  if new.author = 'leo' and new.approved_at is null then
    raise exception 'outreach guard: not approved by Leo' using errcode = 'P0001';
  end if;
  if new.author = 'auto' then
    if not v_settings.auto_send_enabled then
      raise exception 'outreach guard: automatic sending is off for this program' using errcode = 'P0001';
    end if;
    if v_thread.auto_streak >= v_settings.auto_streak_limit then
      raise exception 'outreach guard: automatic streak limit reached' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.outreach_subjects su
                   where su.id = v_thread.current_subject_id and su.program_id = v_thread.program_id
                     and su.auto_enabled and not su.zone_rouge) then
      raise exception 'outreach guard: subject not open to automatic replies' using errcode = 'P0001';
    end if;
  end if;
  if new.send_status = 'en_cours' then
    -- A pause stops cold mail and automatic replies, not Leo answering
    -- someone who wrote to us.
    if (v_mailbox.paused or v_settings.paused) and (new.author = 'auto' or v_unsolicited) then
      raise exception 'outreach guard: mailbox or program paused' using errcode = 'P0001';
    end if;
    if new.kind = 'relance'
       and (v_role <> 'attente' or v_thread.last_inbound_at is not null
            or v_thread.follow_up_count >= v_settings.max_follow_ups) then
      raise exception 'outreach guard: follow-up no longer due' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_messages_guard on public.outreach_messages;
create trigger outreach_messages_guard
  before insert or update of send_status, to_email, author on public.outreach_messages
  for each row execute function public.outreach_guard_outbound();

-- =====================================================================
-- F. Default pipelines
-- =====================================================================

create or replace function public.outreach_seed_default_stages(p_program uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_dir text;
begin
  select direction into v_dir from public.outreach_programs where id = p_program;
  if v_dir is null then
    raise exception 'outreach: unknown program' using errcode = '22023';
  end if;
  if exists (select 1 from public.outreach_program_stages where program_id = p_program) then
    return;
  end if;

  if v_dir = 'sortant' then
    insert into public.outreach_program_stages (program_id, slug, label, role, position, on_board) values
      (p_program, 'a_valider',  'À valider',   'a_valider',    10, true),
      (p_program, 'planifie',   'Planifié',    'planifie',     20, true),
      (p_program, 'envoye',     'Envoyé',      'attente',      30, true),
      (p_program, 'relance',    'Relancé',     'relance',      40, true),
      (p_program, 'a_repondu',  'A répondu',   'conversation', 50, true),
      (p_program, 'partenaire', 'Partenaire',  'succes',       60, true),
      (p_program, 'clos',       'Clos',        'clos',         90, false);
    insert into public.outreach_program_transitions (program_id, from_slug, to_slug, actors) values
      (p_program, 'a_valider',  'planifie',   '{leo}'),
      (p_program, 'a_valider',  'clos',       '{leo}'),
      (p_program, 'planifie',   'a_valider',  '{leo}'),
      (p_program, 'planifie',   'envoye',     '{cron}'),
      (p_program, 'planifie',   'clos',       '{cron,leo}'),
      (p_program, 'envoye',     'relance',    '{cron}'),
      (p_program, 'envoye',     'a_repondu',  '{imap,lien}'),
      (p_program, 'relance',    'a_repondu',  '{imap,lien}'),
      (p_program, 'envoye',     'partenaire', '{lien,leo}'),
      (p_program, 'relance',    'partenaire', '{lien,leo}'),
      (p_program, 'a_repondu',  'partenaire', '{lien,leo}'),
      (p_program, 'envoye',     'clos',       '{cron,imap,lien,leo}'),
      (p_program, 'relance',    'clos',       '{cron,imap,lien,leo}'),
      (p_program, 'a_repondu',  'clos',       '{imap,lien,leo}'),
      (p_program, 'partenaire', 'clos',       '{lien,leo}'),
      (p_program, 'clos',       'a_repondu',  '{imap,leo}');
  else
    insert into public.outreach_program_stages (program_id, slug, label, role, position, on_board) values
      (p_program, 'recu',     'Reçu',      'nouveau',      10, true),
      (p_program, 'en_cours', 'En cours',  'conversation', 20, true),
      (p_program, 'resolu',   'Résolu',    'resolu',       30, true),
      (p_program, 'clos',     'Clos',      'clos',         90, false);
    insert into public.outreach_program_transitions (program_id, from_slug, to_slug, actors) values
      (p_program, 'recu',     'en_cours', '{cron,leo}'),
      (p_program, 'recu',     'resolu',   '{leo}'),
      (p_program, 'recu',     'clos',     '{leo,lien,imap}'),
      (p_program, 'en_cours', 'resolu',   '{leo}'),
      (p_program, 'en_cours', 'clos',     '{leo,lien,imap,cron}'),
      (p_program, 'resolu',   'clos',     '{cron,leo,lien}'),
      (p_program, 'resolu',   'en_cours', '{imap,lien,leo}'),
      (p_program, 'clos',     'en_cours', '{imap,leo}');
  end if;
end;
$$;

-- =====================================================================
-- G. Entries: outbound drafts (skill, admin button) and inbound threads
--    (form, admin button on an object, new mail). One writing path per
--    direction; both share the contact and address helpers.
-- =====================================================================

create or replace function public.outreach_render(p_tpl text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_out text := p_tpl;
  r     record;
begin
  if p_tpl is null then
    return null;
  end if;
  for r in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    v_out := replace(v_out, '{{' || r.key || '}}', coalesce(r.value, ''));
  end loop;
  return v_out;
end;
$$;

-- Find the contact (sejour slug, sejour user, organization, known address,
-- name + city for places), or create it.
create or replace function public.outreach_resolve_contact(p jsonb, p_email text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  p := coalesce(p, '{}'::jsonb);
  if coalesce(p->>'sejour_place_slug', '') <> '' then
    select id into v_id from public.outreach_contacts where sejour_place_slug = p->>'sejour_place_slug';
  end if;
  if v_id is null and coalesce(p->>'sejour_user_id', '') <> '' then
    select id into v_id from public.outreach_contacts where sejour_user_id = p->>'sejour_user_id' limit 1;
  end if;
  if v_id is null and coalesce(p->>'organization_id', '') <> '' then
    select id into v_id from public.outreach_contacts
    where organization_id = (p->>'organization_id')::uuid limit 1;
  end if;
  if v_id is null and coalesce(p_email, '') <> '' then
    select a.contact_id into v_id from public.outreach_addresses a
    where a.email = p_email order by a.created_at limit 1;
  end if;
  -- Name alone is not a sure match: two places (or two people) may share it.
  -- Without a city a new contact is created; Leo merges by hand if needed.
  if v_id is null and coalesce(btrim(p->>'nom'), '') <> '' and coalesce(btrim(p->>'ville'), '') <> ''
     and coalesce(p->>'type', '') <> 'personne' then
    select c.id into v_id from public.outreach_contacts c
    where lower(c.name) = lower(btrim(p->>'nom'))
      and lower(c.city) = lower(btrim(p->>'ville'))
    limit 1;
  end if;
  if v_id is null then
    insert into public.outreach_contacts
      (name, kind, website, city, region, sejour_place_slug, sejour_user_id,
       annuaire_lieu_id, organization_id, basis)
    values (coalesce(nullif(btrim(p->>'nom'), ''), p_email), nullif(p->>'type', ''),
            nullif(p->>'site_web', ''), nullif(p->>'ville', ''), nullif(p->>'region', ''),
            nullif(p->>'sejour_place_slug', ''), nullif(p->>'sejour_user_id', ''),
            nullif(p->>'annuaire_lieu_id', '')::uuid, nullif(p->>'organization_id', '')::uuid,
            coalesce(nullif(p->>'base', ''), 'prospection_b2b'))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.outreach_upsert_address(
  p_contact uuid, p_email text, p jsonb, out o_id uuid, out o_status text)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.outreach_addresses
    (contact_id, email, person_first_name, person_name, person_role, is_role_address,
     source, source_url, source_note, collected_at, verified_at, is_primary)
  values (p_contact, p_email, nullif(p->>'prenom', ''), nullif(p->>'personne', ''),
          nullif(p->>'role', ''), coalesce((p->>'adresse_generique')::boolean, false),
          p->>'source', nullif(p->>'source_url', ''), nullif(p->>'note', ''),
          coalesce(nullif(p->>'collectee_le', '')::timestamptz, now()),
          case when coalesce((p->>'verifiee')::boolean, false) then now() end,
          not exists (select 1 from public.outreach_addresses x
                      where x.contact_id = p_contact and x.is_primary))
  on conflict (contact_id, email) do update
    set person_first_name = coalesce(public.outreach_addresses.person_first_name, excluded.person_first_name),
        person_name       = coalesce(public.outreach_addresses.person_name, excluded.person_name),
        verified_at       = coalesce(public.outreach_addresses.verified_at, excluded.verified_at)
  returning id, status into o_id, o_status;
end;
$$;

-- Outbound drafts. Refuses a program that is unknown, inactive, inbound, or
-- that does not accept this source. Idempotent: a contact already in a
-- thread for this article (or with an open thread, for programs without
-- articles) is skipped. Each item runs in its own sub-transaction. Nothing
-- is ever queued here: every message lands at the 'a_valider' stage.
create or replace function public.outreach_ingest_batch(p_batch jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_program     public.outreach_programs%rowtype;
  v_settings    public.outreach_settings%rowtype;
  v_source      text := coalesce(nullif(p_batch->>'source', ''), 'skill');
  v_article     jsonb := p_batch->'article';
  v_tpl         jsonb := p_batch->'gabarit';
  v_stage       text;
  v_subject_id  uuid;
  v_article_id  uuid;
  v_lieu        jsonb;
  v_addr        jsonb;
  v_brouillon   jsonb;
  v_email       text;
  v_contact_id  uuid;
  v_address_id  uuid;
  v_addr_status text;
  v_thread_id   uuid;
  v_vars        jsonb;
  v_subject     text;
  v_text        text;
  v_follow      text;
  v_custom      boolean;
  v_created     int := 0;
  v_skipped     jsonb := '[]'::jsonb;
  v_warnings    jsonb := '[]'::jsonb;
begin
  if coalesce(p_batch->>'version', '') <> '1' then
    raise exception 'outreach_ingest_batch: unsupported version' using errcode = '22023';
  end if;

  select * into v_program from public.outreach_programs where slug = p_batch->>'program';
  if v_program.id is null then
    raise exception 'outreach_ingest_batch: unknown program' using errcode = '22023';
  end if;
  if v_program.direction <> 'sortant' or not v_program.active then
    raise exception 'outreach_ingest_batch: % is not an active outbound program', v_program.slug
      using errcode = '22023';
  end if;
  if not (v_source = any(v_program.entry_sources)) then
    raise exception 'outreach_ingest_batch: source % not accepted by %', v_source, v_program.slug
      using errcode = '22023';
  end if;

  select * into v_settings from public.outreach_settings where program_id = v_program.id;
  select slug into v_stage from public.outreach_program_stages
  where program_id = v_program.id and role = 'a_valider';
  select id into v_subject_id from public.outreach_subjects
  where program_id = v_program.id and slug = coalesce(nullif(p_batch->>'sujet', ''), 'article');
  if v_subject_id is null then
    raise exception 'outreach_ingest_batch: unknown initial subject for %', v_program.slug using errcode = '22023';
  end if;

  if v_program.uses_articles then
    if v_article is null
       or coalesce(v_article->>'slug', '') !~ '^[a-z0-9-]{3,120}$'
       or coalesce(v_article->>'title', '') = ''
       or coalesce(v_article->>'url', '') !~ '^https://(sejour\.)?casaminga\.com/' then
      raise exception 'outreach_ingest_batch: invalid article block' using errcode = '22023';
    end if;
    insert into public.outreach_articles (source, slug, lang, title, url, published_at)
    values (coalesce(v_article->>'source', 'sejour'), v_article->>'slug',
            coalesce(v_article->>'lang', 'fr'), v_article->>'title', v_article->>'url',
            nullif(v_article->>'published_at', '')::date)
    on conflict (source, slug, lang) do update
      set title = excluded.title,
          url = excluded.url,
          published_at = coalesce(excluded.published_at, public.outreach_articles.published_at)
    returning id into v_article_id;
  end if;

  if jsonb_typeof(p_batch->'lieux') is distinct from 'array'
     or jsonb_array_length(p_batch->'lieux') not between 1 and 100 then
    raise exception 'outreach_ingest_batch: lieux must hold 1 to 100 items' using errcode = '22023';
  end if;

  for v_lieu in select value from jsonb_array_elements(p_batch->'lieux') loop
    begin
      v_addr      := coalesce(v_lieu->'adresse', '{}'::jsonb);
      v_brouillon := coalesce(v_lieu->'brouillon', '{}'::jsonb);
      v_email     := lower(btrim(coalesce(v_addr->>'email', '')));

      if coalesce(btrim(v_lieu->>'nom'), '') = ''
         or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
         or coalesce(v_addr->>'source', '') = '' then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'champs_manquants');
        continue;
      end if;
      if exists (select 1 from public.outreach_suppressions s where s.email = v_email) then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'adresse_supprimee');
        continue;
      end if;

      v_contact_id := public.outreach_resolve_contact(v_lieu, v_email);
      if (select do_not_contact from public.outreach_contacts where id = v_contact_id) then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'ne_plus_ecrire');
        continue;
      end if;

      select o_id, o_status into v_address_id, v_addr_status
      from public.outreach_upsert_address(v_contact_id, v_email, v_addr);
      if v_addr_status in ('invalide', 'opt_out') then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'adresse_' || v_addr_status);
        continue;
      end if;

      if exists (select 1 from public.outreach_threads t
                 join public.outreach_program_stages st on st.program_id = t.program_id and st.slug = t.status
                 where t.program_id = v_program.id and t.contact_id = v_contact_id
                   and ((v_article_id is not null and t.article_id = v_article_id)
                        or (v_article_id is null and st.role <> 'clos'))) then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'deja_en_base');
        continue;
      end if;

      v_vars := jsonb_build_object(
        'lieu', btrim(v_lieu->>'nom'),
        'bonjour', case when coalesce(v_addr->>'prenom', '') <> ''
                        then 'Bonjour ' || btrim(v_addr->>'prenom') || ','
                        else 'Bonjour,' end,
        'phrase', coalesce(v_brouillon->>'phrase', ''),
        'article_titre', coalesce(v_article->>'title', ''),
        'article_url', coalesce(v_article->>'url', ''));

      v_custom := coalesce(v_brouillon->>'texte', '') <> '';
      if v_custom then
        v_text := public.outreach_render(v_brouillon->>'texte', v_vars);
      elsif v_tpl is not null and coalesce(v_brouillon->>'phrase', '') <> '' then
        v_text := public.outreach_render(v_tpl->>'texte', v_vars);
      else
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'brouillon_manquant');
        continue;
      end if;
      v_subject := public.outreach_render(coalesce(nullif(v_brouillon->>'objet', ''), v_tpl->>'objet'), v_vars);
      v_follow  := public.outreach_render(coalesce(nullif(v_lieu->'relance'->>'texte', ''), v_tpl->>'relance'), v_vars);

      if coalesce(v_subject, '') = '' or v_text ~ '\{\{' or v_subject ~ '\{\{'
         or coalesce(v_follow, '') ~ '\{\{' then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'variable_non_remplacee');
        continue;
      end if;
      if length(v_text) > 2500 or length(coalesce(v_follow, '')) > 1200 then
        v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'trop_long');
        continue;
      end if;

      if exists (select 1 from public.outreach_threads t
                 where t.contact_id = v_contact_id
                   and t.last_outbound_at > now() - make_interval(days => v_settings.min_days_between_threads)) then
        v_warnings := v_warnings || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'contacte_recemment');
      end if;

      insert into public.outreach_threads
        (program_id, contact_id, address_id, article_id, initial_subject_id, current_subject_id,
         email_subject, status, template_id, personal_line, is_custom, article_context, created_by)
      values (v_program.id, v_contact_id, v_address_id, v_article_id, v_subject_id, v_subject_id,
              v_subject, v_stage, v_tpl->>'id', nullif(v_brouillon->>'phrase', ''), v_custom,
              jsonb_build_object('citation', coalesce(v_lieu->'citation', '{}'::jsonb),
                                 'photos',   coalesce(v_lieu->'photos', '[]'::jsonb),
                                 'demande',  coalesce(v_lieu->'demande', '[]'::jsonb)),
              case when v_source = 'admin' then 'leo' else 'ingest' end)
      returning id into v_thread_id;

      insert into public.outreach_messages
        (thread_id, direction, kind, to_email, subject, draft_text, draft_source, body_text, send_status, author)
      values (v_thread_id, 'out', 'initial', v_email, v_subject, v_text,
              case when v_source = 'admin' then 'leo' else 'ingest' end, v_text, 'a_valider', 'leo');

      if coalesce(v_follow, '') <> '' and v_settings.max_follow_ups > 0 then
        insert into public.outreach_messages
          (thread_id, direction, kind, to_email, subject, draft_text, draft_source, body_text, send_status, author)
        values (v_thread_id, 'out', 'relance', v_email, 'Re: ' || v_subject, v_follow,
                case when v_source = 'admin' then 'leo' else 'ingest' end, v_follow, 'a_valider', 'leo');
      end if;

      insert into public.outreach_events (program_id, thread_id, contact_id, actor, type, data)
      values (v_program.id, v_thread_id, v_contact_id, 'ingest', 'ingest.draft',
              jsonb_build_object('source', v_source, 'article', v_article->>'slug',
                                 'prepared_by', coalesce(p_batch->>'prepared_by', 'inconnu'),
                                 'template', v_tpl->>'id', 'custom', v_custom));
      v_created := v_created + 1;
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('nom', v_lieu->>'nom', 'motif', 'erreur', 'detail', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('program', v_program.slug, 'article_id', v_article_id, 'crees', v_created,
                            'ignores', v_skipped, 'avertissements', v_warnings);
end;
$$;

-- Inbound thread: a form, an admin button on an object (claim, ticket), or a
-- new mail read by the IMAP cron. Refuses a program that is unknown,
-- inactive, outbound, or that does not accept this source. Idempotent on
-- the Message-ID. A message about an external object that already has an
-- open thread is appended to it. Reopening a resolved or closed thread is
-- done by the caller (transition resolu/clos -> en_cours, actor imap).
create or replace function public.outreach_open_inbound(p_entry jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_program     public.outreach_programs%rowtype;
  v_settings    public.outreach_settings%rowtype;
  v_source      text := coalesce(p_entry->>'source', '');
  v_contact     jsonb := coalesce(p_entry->'contact', '{}'::jsonb);
  v_addr        jsonb := coalesce(p_entry->'adresse', '{}'::jsonb);
  v_msg         jsonb := p_entry->'message';
  v_first_out   jsonb := p_entry->'premier_message_sortant';
  v_ext_type    text := nullif(p_entry->'externe'->>'type', '');
  v_ext_id      text := nullif(p_entry->'externe'->>'id', '');
  v_uncertain   boolean := coalesce((p_entry->'tri'->>'incertain')::boolean, false);
  v_email       text := lower(btrim(coalesce(v_addr->>'email', '')));
  v_contact_id  uuid;
  v_address_id  uuid;
  v_addr_status text;
  v_thread_id   uuid;
  v_message_id  uuid;
  v_stage       text;
  v_subject     text;
  v_created     boolean := false;
begin
  if coalesce(p_entry->>'version', '') <> '1' then
    raise exception 'outreach_open_inbound: unsupported version' using errcode = '22023';
  end if;
  select * into v_program from public.outreach_programs where slug = p_entry->>'program';
  if v_program.id is null or not v_program.active or v_program.direction <> 'entrant' then
    raise exception 'outreach_open_inbound: not an active inbound program' using errcode = '22023';
  end if;
  if not (v_source = any(v_program.entry_sources)) then
    raise exception 'outreach_open_inbound: source % not accepted by %', v_source, v_program.slug
      using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'outreach_open_inbound: invalid email' using errcode = '22023';
  end if;
  if v_msg is null and v_first_out is null then
    raise exception 'outreach_open_inbound: nothing to open' using errcode = '22023';
  end if;
  if v_first_out is not null and v_source <> 'admin' then
    raise exception 'outreach_open_inbound: only the admin writes first' using errcode = '22023';
  end if;
  if length(coalesce(v_msg->>'texte', '')) > 20000 then
    raise exception 'outreach_open_inbound: message too long' using errcode = '22023';
  end if;

  if coalesce(v_msg->>'message_id', '') <> '' then
    select m.thread_id into v_thread_id from public.outreach_messages m where m.message_id = v_msg->>'message_id';
    if v_thread_id is not null then
      return jsonb_build_object('thread_id', v_thread_id, 'cree', false, 'motif', 'deja_recu');
    end if;
  end if;

  select * into v_settings from public.outreach_settings where program_id = v_program.id;
  v_contact_id := public.outreach_resolve_contact(
                    v_contact || jsonb_build_object('base', 'demande_entrante'), v_email);
  select o_id, o_status into v_address_id, v_addr_status
  from public.outreach_upsert_address(
         v_contact_id, v_email,
         v_addr || jsonb_build_object(
           'source', coalesce(nullif(v_addr->>'source', ''),
                              case v_source when 'mail' then 'mail_entrant'
                                            when 'formulaire' then 'formulaire' else 'leo' end),
           'verifiee', v_source = 'mail'));

  if v_ext_id is not null then
    select t.id into v_thread_id
    from public.outreach_threads t
    join public.outreach_program_stages st on st.program_id = t.program_id and st.slug = t.status
    where t.program_id = v_program.id and t.external_type = v_ext_type and t.external_id = v_ext_id
      and st.role <> 'clos'
    limit 1;
  end if;

  v_subject := left(coalesce(nullif(btrim(v_msg->>'objet'), ''), nullif(btrim(v_first_out->>'objet'), ''),
                             v_program.label), 200);
  if length(v_subject) < 3 then
    v_subject := v_program.label;
  end if;

  if v_thread_id is null then
    select slug into v_stage from public.outreach_program_stages
    where program_id = v_program.id and role = 'nouveau';
    insert into public.outreach_threads
      (program_id, contact_id, address_id, email_subject, status, external_type, external_id,
       first_inbound_at, sla_due_at, needs_leo, needs_leo_reason, needs_leo_since,
       triage_confidence, created_by)
    values (v_program.id, v_contact_id, v_address_id, v_subject, v_stage, v_ext_type, v_ext_id,
            case when v_msg is not null then now() end,
            case when v_msg is not null then now() + make_interval(hours => v_settings.sla_first_response_hours) end,
            v_uncertain, case when v_uncertain then 'tri_incertain' end, case when v_uncertain then now() end,
            nullif(p_entry->'tri'->>'confiance', '')::numeric,
            case v_source when 'mail' then 'imap' when 'formulaire' then 'formulaire' else 'leo' end)
    returning id into v_thread_id;
    v_created := true;
    insert into public.outreach_events (program_id, thread_id, contact_id, actor, type, data)
    values (v_program.id, v_thread_id, v_contact_id,
            case v_source when 'mail' then 'imap' when 'formulaire' then 'lien' else 'leo' end,
            'thread.opened', jsonb_build_object('source', v_source, 'externe', v_ext_type,
                                                'tri_incertain', v_uncertain));
  end if;

  if v_msg is not null then
    insert into public.outreach_messages
      (thread_id, direction, kind, message_id, in_reply_to, references_ids, from_email, subject,
       body_text, body_reply, attachments, received_at, match_method)
    values (v_thread_id, 'in', case when v_source = 'formulaire' then 'formulaire' else 'entrant' end,
            nullif(v_msg->>'message_id', ''), nullif(v_msg->>'in_reply_to', ''),
            array(select jsonb_array_elements_text(coalesce(v_msg->'references', '[]'::jsonb))),
            v_email, v_subject, v_msg->>'texte', coalesce(v_msg->>'reponse', v_msg->>'texte'),
            coalesce(v_msg->'pieces_jointes', '[]'::jsonb),
            coalesce(nullif(v_msg->>'recu_le', '')::timestamptz, now()),
            case v_source when 'mail' then 'nouveau_fil' when 'formulaire' then 'formulaire' else 'admin' end)
    returning id into v_message_id;
    update public.outreach_threads
       set last_inbound_at = now(), first_inbound_at = coalesce(first_inbound_at, now())
     where id = v_thread_id;
  end if;

  if v_first_out is not null then
    insert into public.outreach_messages
      (thread_id, direction, kind, to_email, subject, draft_text, draft_source, body_text, send_status, author)
    values (v_thread_id, 'out', 'initial', v_email, v_subject, v_first_out->>'texte', 'leo',
            v_first_out->>'texte', 'a_valider', 'leo');
  end if;

  return jsonb_build_object('program', v_program.slug, 'thread_id', v_thread_id, 'contact_id', v_contact_id,
                            'message_id', v_message_id, 'cree', v_created,
                            'adresse', v_addr_status);
end;
$$;

-- =====================================================================
-- H. Monitoring views (security_invoker: service role only). Every view
--    carries program_id or mailbox_key; totals are sums of the rows.
-- =====================================================================

create or replace view public.outreach_v_program_stats
with (security_invoker = true) as
select p.id as program_id, p.slug, p.label, p.direction, p.mailbox_key, p.active,
       x.fils, x.actifs, x.a_toi, x.clos, x.succes, x.contactes, x.ont_repondu,
       round(100.0 * x.ont_repondu / nullif(x.contactes, 0), 1) as taux_reponse_pct,
       x.hors_delai, x.premiere_reponse_h_mediane
from public.outreach_programs p
cross join lateral (
  select count(t.id)                                                          as fils,
         count(t.id) filter (where st.role <> 'clos')                         as actifs,
         count(t.id) filter (where t.needs_leo)                               as a_toi,
         count(t.id) filter (where st.role = 'clos')                          as clos,
         count(t.id) filter (where st.role = 'succes')                        as succes,
         count(t.id) filter (where t.first_sent_at is not null)               as contactes,
         count(t.id) filter (where t.first_sent_at is not null
                               and t.last_inbound_at is not null)             as ont_repondu,
         count(t.id) filter (where t.sla_due_at < now() and t.first_response_at is null
                               and st.role <> 'clos')                         as hors_delai,
         round((percentile_cont(0.5) within group (
                  order by extract(epoch from (t.first_response_at - t.first_inbound_at))) / 3600.0)::numeric, 1)
                                                                              as premiere_reponse_h_mediane
  from public.outreach_threads t
  join public.outreach_program_stages st on st.program_id = t.program_id and st.slug = t.status
  where t.program_id = p.id
) x;

create or replace view public.outreach_v_article_stats
with (security_invoker = true) as
select t.program_id, a.id as article_id, a.slug, a.lang, a.title, a.url,
       count(*)                                                     as fils,
       count(*) filter (where st.role = 'a_valider')                as a_valider,
       count(*) filter (where t.first_sent_at is not null)          as contactes,
       count(*) filter (where t.last_inbound_at is not null)        as ont_repondu,
       count(*) filter (where st.role = 'succes')                   as partenaires,
       count(*) filter (where t.photos_granted_at is not null)      as photos,
       count(*) filter (where t.closed_reason = 'ne_plus_ecrire')   as ne_plus_ecrire,
       count(*) filter (where t.closed_reason = 'rebond')           as rebonds,
       count(*) filter (where t.closed_reason = 'sans_suite')       as sans_suite,
       round(100.0 * count(*) filter (where t.last_inbound_at is not null)
             / nullif(count(*) filter (where t.first_sent_at is not null), 0), 1) as taux_reponse_pct
from public.outreach_articles a
join public.outreach_threads t on t.article_id = a.id
join public.outreach_program_stages st on st.program_id = t.program_id and st.slug = t.status
group by t.program_id, a.id, a.slug, a.lang, a.title, a.url;

create or replace view public.outreach_v_weekly
with (security_invoker = true) as
select e.program_id,
       date_trunc('week', e.occurred_at at time zone 'Europe/Paris')::date as semaine,
       count(*) filter (where e.type = 'message.sent' and e.data->>'kind' = 'initial') as premiers_contacts,
       count(*) filter (where e.type = 'message.sent' and e.data->>'kind' = 'relance') as relances,
       count(*) filter (where e.type = 'message.sent' and e.data->>'kind' = 'reponse'
                          and e.data->>'author' = 'leo')                             as reponses_leo,
       count(*) filter (where e.type = 'message.sent' and e.data->>'kind' = 'reponse'
                          and e.data->>'author' = 'auto')                            as reponses_auto,
       count(*) filter (where e.type = 'thread.opened')                              as fils_ouverts,
       count(*) filter (where e.type = 'inbound.received')                           as messages_recus,
       count(*) filter (where e.type = 'bounce.hard')                                as rebonds,
       count(*) filter (where e.type = 'complaint.received')                         as plaintes,
       count(*) filter (where e.type in ('link.opt_out', 'link.list_unsubscribe', 'reply.opt_out')) as desinscriptions,
       count(*) filter (where e.type like 'link.%' and e.type <> 'link.opened')     as actions_lien
from public.outreach_events e
group by e.program_id, 2;

create or replace view public.outreach_v_subject_quality
with (security_invoker = true) as
with replies as (
  select i.ai_subject_id as subject_id, o.author, o.modified_by_leo,
         row_number() over (partition by i.ai_subject_id, o.author order by o.sent_at desc) as rn
  from public.outreach_messages o
  join public.outreach_messages i on i.id = o.reply_to_message_id
  where o.direction = 'out' and o.kind = 'reponse' and o.send_status = 'envoye'
    and i.ai_subject_id is not null
),
inbound as (
  select ai_subject_id as subject_id,
         count(*)                                       as recus,
         count(*) filter (where ai_decision = 'auto')   as decisions_auto,
         count(*) filter (where ai_decision = 'a_toi')  as decisions_a_toi,
         round(avg(ai_confidence), 2)                   as confiance_moyenne
  from public.outreach_messages
  where direction = 'in' and kind in ('entrant', 'formulaire')
    and classified_at is not null and ai_subject_id is not null
  group by 1
)
select s.program_id, p.slug as program_slug, s.id as subject_id, s.slug, s.label,
       s.zone_rouge, s.auto_enabled,
       coalesce(i.recus, 0)            as recus,
       coalesce(i.decisions_auto, 0)   as decisions_auto,
       coalesce(i.decisions_a_toi, 0)  as decisions_a_toi,
       i.confiance_moyenne,
       (select count(*) from replies r where r.subject_id = s.id and r.author = 'leo')  as relues_par_leo,
       (select count(*) from replies r where r.subject_id = s.id and r.author = 'auto') as envoyees_auto,
       (select round(avg(case when r.modified_by_leo then 1.0 else 0.0 end), 3)
          from replies r where r.subject_id = s.id and r.author = 'leo' and r.rn <= 20) as part_modifiee_20_dernieres
from public.outreach_subjects s
join public.outreach_programs p on p.id = s.program_id
left join inbound i on i.subject_id = s.id;

create or replace view public.outreach_v_mailbox_health
with (security_invoker = true) as
select mb.key as mailbox_key, mb.address, mb.active, mb.paused, mb.pause_reason, mb.paused_at,
       mb.hard_daily_cap,
       w.envois_froids, w.envois, w.rebonds, w.plaintes, w.desinscriptions,
       round(w.rebonds::numeric / nullif(case when w.envois_froids > 0 then w.envois_froids else w.envois end, 0), 4)
                                                                                as taux_rebond,
       round(w.plaintes::numeric / nullif(w.envois, 0), 4)                      as taux_plainte,
       d.envois_aujourdhui, d.froids_aujourdhui,
       q.file_attente, q.envois_bloques
from public.outreach_mailboxes mb
cross join lateral (
  select count(*) filter (where e.type = 'message.sent' and e.data->>'kind' in ('initial', 'relance')) as envois_froids,
         count(*) filter (where e.type = 'message.sent')        as envois,
         count(*) filter (where e.type = 'bounce.hard')         as rebonds,
         count(*) filter (where e.type = 'complaint.received')  as plaintes,
         count(*) filter (where e.type in ('link.opt_out', 'link.list_unsubscribe', 'reply.opt_out')) as desinscriptions
  from public.outreach_events e
  join public.outreach_programs p on p.id = e.program_id
  where p.mailbox_key = mb.key
    and e.occurred_at >= now() - make_interval(days => mb.health_window_days)
) w
cross join lateral (
  select count(*)                                                        as envois_aujourdhui,
         count(*) filter (where e.data->>'kind' in ('initial', 'relance')) as froids_aujourdhui
  from public.outreach_events e
  join public.outreach_programs p on p.id = e.program_id
  where p.mailbox_key = mb.key and e.type = 'message.sent'
    and (e.occurred_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
) d
cross join lateral (
  select count(*) filter (where m.send_status = 'planifie') as file_attente,
         count(*) filter (where m.send_status = 'en_cours'
                            and m.updated_at < now() - interval '15 minutes') as envois_bloques
  from public.outreach_messages m
  join public.outreach_threads t on t.id = m.thread_id
  join public.outreach_programs p on p.id = t.program_id
  where p.mailbox_key = mb.key and m.send_status in ('planifie', 'en_cours')
) q;

-- =====================================================================
-- I. Access: RLS without policy, explicit REVOKE / GRANT
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array['outreach_mailboxes', 'outreach_programs', 'outreach_program_contexts',
                           'outreach_program_stages', 'outreach_program_transitions', 'outreach_settings',
                           'outreach_subjects', 'outreach_red_zones', 'outreach_articles',
                           'outreach_contacts', 'outreach_addresses', 'outreach_threads',
                           'outreach_messages', 'outreach_photo_grants', 'outreach_suppressions',
                           'outreach_events', 'outreach_knowledge', 'outreach_mailbox_state']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;

  foreach t in array array['outreach_v_program_stats', 'outreach_v_article_stats', 'outreach_v_weekly',
                           'outreach_v_subject_quality', 'outreach_v_mailbox_health']
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to service_role', t);
  end loop;
end;
$$;

revoke all on sequence public.outreach_events_id_seq from anon, authenticated;
grant usage, select on sequence public.outreach_events_id_seq to service_role;

-- Functions: nothing for anon/authenticated (0018 default), stated anyway.
revoke all on function public.outreach_touch()                          from public, anon, authenticated;
revoke all on function public.outreach_contexts_freeze()                from public, anon, authenticated;
revoke all on function public.outreach_programs_activation()            from public, anon, authenticated;
revoke all on function public.outreach_threads_stage()                  from public, anon, authenticated;
revoke all on function public.outreach_events_immutable()               from public, anon, authenticated;
revoke all on function public.outreach_guard_outbound()                 from public, anon, authenticated;
revoke all on function public.outreach_program_ready(uuid)              from public, anon, authenticated;
revoke all on function public.outreach_seed_default_stages(uuid)        from public, anon, authenticated;
revoke all on function public.outreach_render(text, jsonb)              from public, anon, authenticated;
revoke all on function public.outreach_resolve_contact(jsonb, text)     from public, anon, authenticated;
revoke all on function public.outreach_upsert_address(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.outreach_ingest_batch(jsonb)              from public, anon, authenticated;
revoke all on function public.outreach_open_inbound(jsonb)              from public, anon, authenticated;
grant execute on function public.outreach_program_ready(uuid)           to service_role;
grant execute on function public.outreach_seed_default_stages(uuid)     to service_role;
grant execute on function public.outreach_render(text, jsonb)           to service_role;
grant execute on function public.outreach_resolve_contact(jsonb, text)  to service_role;
grant execute on function public.outreach_upsert_address(uuid, text, jsonb) to service_role;
grant execute on function public.outreach_ingest_batch(jsonb)           to service_role;
grant execute on function public.outreach_open_inbound(jsonb)           to service_role;

-- =====================================================================
-- J. Private storage bucket (no policy: service role only)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outreach-files', 'outreach-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- =====================================================================
-- K. Seed: mailboxes, programs (inactive), stages, settings, subjects,
--    red zones. Contexts are NOT seeded: version 1 of each is inserted
--    after Leo reads it (spec section 13), then the program is activated.
-- =====================================================================

insert into public.outreach_mailboxes (key, label, address, env_prefix, personal) values
  ('leo',               'Boîte de Léo',          'leo@casaminga.com',            'OUTREACH_',          true),
  ('sejour_contact',    'Contact sejour',        'contact@sejour.casaminga.com', 'SAV_SEJOUR_',        false),
  ('casaminga_contact', 'Contact Casa Minga',    'contact@casaminga.com',        'CONTACT_CASAMINGA_', false)
on conflict (key) do nothing;

insert into public.outreach_programs
  (slug, label, description, direction, mailbox_key, sender_name, address_form, signature,
   entry_sources, link_actions, uses_articles) values
  ('articles-sejour', 'Lieux cités dans les articles',
   'Après chaque article publié sur sejour.casaminga.com, Léo écrit aux lieux cités : retour sur l''article, usage de leurs photos, découverte de Casa Minga.',
   'sortant', 'leo', 'Léo Durand', 'tu',
   E'Léo Durand\nCasa Minga, sejour.casaminga.com',
   '{skill,admin}', '{photos,correction,stop}', true),
  ('sav-sejour', 'SAV sejour',
   'Questions et problèmes des membres de sejour.casaminga.com : points d''hospitalité, séjours, échanges, compte, remboursements.',
   'entrant', 'sejour_contact', 'L''équipe Casa Minga', 'vous',
   E'L''équipe Casa Minga\nsejour.casaminga.com',
   '{mail,formulaire,admin}', '{resolu}', false),
  ('revendication-fiche', 'Revendication de fiche',
   'Échanges avec une personne qui revendique la fiche d''un lieu importé sur casaminga.com : état de la demande, justificatif de son lien avec le lieu.',
   'entrant', 'casaminga_contact', 'L''équipe Casa Minga', 'vous',
   E'L''équipe Casa Minga\ncasaminga.com',
   '{admin,mail}', '{justificatif}', false),
  ('billets-comptes', 'Billets et comptes',
   'Problèmes de billet (achat, annulation, accès à l''événement) et de compte sur admin.casaminga.com et casaminga.com.',
   'entrant', 'casaminga_contact', 'L''équipe Casa Minga', 'vous',
   E'L''équipe Casa Minga\ncasaminga.com',
   '{mail,admin}', '{resolu}', false)
on conflict (slug) do nothing;

select public.outreach_seed_default_stages(id) from public.outreach_programs;

insert into public.outreach_settings (program_id)
select id from public.outreach_programs
on conflict (program_id) do nothing;

update public.outreach_mailboxes
   set fallback_program_id = (select id from public.outreach_programs where slug = 'billets-comptes')
 where key = 'casaminga_contact' and fallback_program_id is null;

insert into public.outreach_subjects (program_id, slug, label, description, zone_rouge, position)
select p.id, v.slug, v.label, v.description, v.zone_rouge, v.position
from public.outreach_programs p
join (values
  ('articles-sejour', 'article',     'Retour sur l''article',   'Réaction à l''article qui cite le lieu : remerciement, avis, précision sans demande de modification.', false, 10),
  ('articles-sejour', 'photos',      'Usage des photos',        'Accord, refus ou question sur l''usage des photos du lieu, la licence, le crédit.', false, 20),
  ('articles-sejour', 'decouverte',  'Découvrir Casa Minga',    'Ce qu''est Casa Minga, à qui ça s''adresse, comment ça marche.', false, 30),
  ('articles-sejour', 'inscription', 'Inscrire le lieu',        'Créer la fiche du lieu, fonctionnement général.', false, 40),
  ('articles-sejour', 'sejour',      'Séjours et échanges',     'Accueil de voyageurs, points d''hospitalité, échanges entre lieux.', false, 50),
  ('articles-sejour', 'correction',  'Correction de l''article','Demande de modifier ou de retirer un passage publié.', true, 60),
  ('articles-sejour', 'partenariat', 'Partenariat',             'Collaboration, relais, événement commun.', true, 70),
  ('articles-sejour', 'litige',      'Litige ou mécontentement','Ton agacé, reproche, menace, presse, avocat.', true, 80),
  ('articles-sejour', 'autre',       'Autre',                   'Tout ce qui ne rentre dans aucun sujet.', true, 90),
  ('sav-sejour', 'points_hospitalite', 'Points d''hospitalité', 'Solde, gain, dépense et valeur des points.', false, 10),
  ('sav-sejour', 'sejour',             'Séjour',                'Réservation, dates, annulation, déroulé d''un séjour.', false, 20),
  ('sav-sejour', 'echange',            'Échange',               'Échange de logement ou de séjour entre membres.', false, 30),
  ('sav-sejour', 'compte',             'Compte',                'Connexion, profil, vérification du compte.', false, 40),
  ('sav-sejour', 'remboursement',      'Remboursement',         'Remboursement, paiement, prix membre.', true, 50),
  ('sav-sejour', 'signalement',        'Signalement',           'Comportement, sécurité, litige entre membres.', true, 60),
  ('sav-sejour', 'autre',              'Autre',                 'Tout ce qui ne rentre dans aucun sujet.', true, 90),
  ('revendication-fiche', 'etat_demande',    'État de la demande',      'Où en est la revendication, délai, prochaine étape.', false, 10),
  ('revendication-fiche', 'justificatif',    'Justificatif',            'Quel justificatif fournir, comment le déposer.', false, 20),
  ('revendication-fiche', 'identite_lien',   'Lien avec le lieu',       'Preuve que la personne représente le lieu.', true, 30),
  ('revendication-fiche', 'acces_compte',    'Accès au compte',         'Invitation non reçue, compte à créer, adresse à changer.', true, 40),
  ('revendication-fiche', 'contenu_fiche',   'Contenu de la fiche',     'Informations importées à corriger ou retirer.', true, 50),
  ('revendication-fiche', 'autre',           'Autre',                   'Tout ce qui ne rentre dans aucun sujet.', true, 90),
  ('billets-comptes', 'billet',    'Billet',                 'Billet non reçu, QR code, accès à l''événement.', false, 10),
  ('billets-comptes', 'annulation','Annulation',             'Annuler une place, liste d''attente.', false, 20),
  ('billets-comptes', 'compte',    'Compte',                 'Connexion, mot de passe, lien d''espace adhérent.', false, 30),
  ('billets-comptes', 'paiement',  'Paiement',               'Paiement, remboursement, reçu, facture.', true, 40),
  ('billets-comptes', 'autre',     'Autre',                  'Tout ce qui ne rentre dans aucun sujet.', true, 90)
) as v(program, slug, label, description, zone_rouge, position) on v.program = p.slug
on conflict (program_id, slug) do nothing;

-- Universal red zones (program_id null), then program ones.
insert into public.outreach_red_zones (program_id, code, label, description, position) values
  (null, 'argent',               'Argent',                 'Prix, paiement, remboursement, facture, gratuité, cotisation.', 10),
  (null, 'identite',             'Identité',               'Qui est la personne, preuve d''identité ou de qualité, pièce d''identité, changement de titulaire.', 20),
  (null, 'engagement',           'Engagement',             'Une date, une présence, une prestation, un délai, un partenariat, une décision.', 30),
  (null, 'donnees_personnelles', 'Données personnelles',   'Origine de l''adresse, accès, rectification, suppression, droits.', 40),
  (null, 'litige',               'Litige',                 'Ton agacé, reproche, plainte, menace, presse, avocat, mise en demeure.', 50),
  (null, 'hors_corpus',          'Hors corpus',            'Tout ce que la base de connaissances ne couvre pas.', 60)
on conflict do nothing;

insert into public.outreach_red_zones (program_id, code, label, description, position)
select p.id, v.code, v.label, v.description, v.position
from public.outreach_programs p
join (values
  ('articles-sejour',     'modification_article',     'Modification d''article', 'Corriger, compléter, retirer un passage publié, droit de réponse.', 110),
  ('sav-sejour',          'responsabilite_assurance', 'Responsabilité',          'Qui est responsable, assurance, accident, dégât, sinistre.', 110),
  ('sav-sejour',          'securite_personnes',       'Sécurité des personnes',  'Danger, comportement inquiétant, urgence.', 120),
  ('revendication-fiche', 'decision_revendication',   'Décision',                'Accorder, refuser ou promettre l''accès à une fiche.', 110),
  ('billets-comptes',     'acces_evenement',          'Accès à l''événement',    'Promettre une place, une entrée, une exception.', 110)
) as v(program, code, label, description, position) on v.program = p.slug
on conflict do nothing;

commit;
