-- ════════════════════════════════════════════════════════════
-- REVENDICATION D'UNE FICHE IMPORTÉE
-- ════════════════════════════════════════════════════════════
-- L'agenda public de casaminga.com agrège des événements moissonnés dans les
-- agendas ouverts du territoire : 118 des 132 organisations en base n'ont
-- jamais rien demandé à Casa Minga, elles ont été importées. La revendication
-- est le geste par lequel un de ces lieux reprend la main sur sa fiche.
--
-- Elle ne crée PAS d'organisation : elle rattache une personne à celle qui
-- existe déjà, avec ses événements et son établissement géolocalisé. C'est le
-- couple `invitations` + /rejoindre/[token] qui s'en charge, inchangé.
-- `signup/actions.ts` va dans l'autre sens et n'intervient pas ici.

-- ── 1. Provenance et revendication, sur organizations ────────
--
-- Jusqu'ici, « cette fiche est-elle importée ? » se lisait dans le préfixe du
-- slug (`import-…`). C'était commode et c'est devenu un piège : un lieu qui
-- revendique doit cesser d'être importé, or renommer son slug casserait les
-- liens déjà publiés et référencés. Le repère déménage donc dans une colonne,
-- que la revendication peut modifier sans rien casser.
--
-- Pas de contrainte de valeurs sur `source` : chaque nouvel agenda moissonné
-- ajouterait sinon une migration. La règle tient en une phrase, et le code
-- l'applique en un seul endroit (lib/imported.ts) : tout ce qui n'est pas
-- 'casaminga' a été moissonné ailleurs.
alter table public.organizations
  add column if not exists source text not null default 'casaminga';

comment on column public.organizations.source is
  'Origine de la fiche : ''casaminga'' si elle est née dans l''admin, sinon le nom de l''agenda moissonné (''openagenda''…).';

-- Date à laquelle un responsable du lieu a consommé son invitation de
-- revendication. Renseignée = le lieu est maître de sa fiche ; l'encart de
-- provenance disparaît, la vitrine s'ouvre, l'annuaire l'accepte.
alter table public.organizations
  add column if not exists claimed_at timestamptz;

comment on column public.organizations.claimed_at is
  'Horodatage de la revendication. Nul tant que le lieu n''a pas repris sa fiche.';

-- Rétro-remplissage : les fiches déjà importées portent le préfixe de slug.
-- C'est la dernière fois que ce préfixe sert de critère.
update public.organizations
   set source = 'openagenda'
 where slug like 'import-%'
   and source = 'casaminga';

-- ── 2. claims — les demandes de revendication ────────────────
--
-- Une table plutôt qu'un simple courriel : il faut pouvoir dire à un
-- demandeur ce qu'est devenue sa demande, éviter qu'un rafraîchissement de
-- page n'en crée dix, et garder trace de qui a obtenu les clés d'un lieu.
create table if not exists public.claims (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,

  -- L'événement d'où part la demande. Facultatif : la revendication survivra
  -- à la suppression de la fiche qui l'a déclenchée, et pourra un jour partir
  -- d'ailleurs (annuaire, courriel de prospection).
  event_id         uuid references public.evenements(id) on delete set null,

  -- Le demandeur, tel qu'il se déclare. Rien n'est vérifié à ce stade :
  -- c'est l'ADRESSE DU LIEU, et non celle-ci, qui reçoit l'invitation en
  -- voie automatique.
  full_name        text not null,
  role_label       text,
  email            text not null,
  phone            text,
  message          text,

  -- en_attente : voie manuelle, la demande attend un arbitrage.
  -- invite      : une invitation est partie, elle n'a pas encore été utilisée.
  -- accepte     : l'invitation a été consommée, le lieu est revendiqué.
  -- refuse      : demande écartée.
  status           text not null default 'en_attente'
                   check (status in ('en_attente', 'invite', 'accepte', 'refuse')),

  -- auto   : le lieu avait publié une adresse de contact, l'invitation y est
  --          partie sans intervention humaine. Quiconque relève le courrier
  --          officiel du lieu est légitime, personne d'autre ne reçoit rien.
  -- manuel : aucune adresse connue (103 lieux sur 118), Léo tranche.
  verification     text not null
                   check (verification in ('auto', 'manuel')),

  invitation_id    uuid references public.invitations(id) on delete set null,

  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  decided_by       uuid references public.profiles(id) on delete set null,
  refusal_reason   text
);

-- L'écran d'arbitrage lit les demandes en attente, les plus anciennes d'abord.
create index if not exists claims_status_idx
  on public.claims (status, created_at);

create index if not exists claims_org_idx
  on public.claims (organization_id);

-- Garde-fou : une seule demande vivante par lieu et par adresse. Sans lui, un
-- rafraîchissement de page envoie dix courriels au même lieu.
create unique index if not exists claims_vivante_unique
  on public.claims (organization_id, lower(email))
  where status in ('en_attente', 'invite');

-- ── Accès ────────────────────────────────────────────────────
-- RLS activée SANS AUCUNE POLITIQUE, comme platform_tasks : la table est
-- inaccessible à `anon` comme à `authenticated`. Seul `service_role` la voit,
-- et il n'est employé que dans le code serveur — l'action publique de dépôt
-- après validation du formulaire, l'écran d'arbitrage après
-- requireSuperAdmin(). Une demande de revendication nomme une personne et
-- son téléphone : rien de tout cela ne doit être lisible depuis le navigateur.
alter table public.claims enable row level security;
