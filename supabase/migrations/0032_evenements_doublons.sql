-- 0032_evenements_doublons
--
-- Trace of duplicates found between import sources (rule R7, design P3):
-- the kept event, the discarded or hidden duplicate, why, and what was copied
-- from the duplicate to enrich the kept one. Nothing is ever deleted.
--
-- Additive: one new table, no function, no change to existing tables.
-- Written only by the import scripts and scripts/dedoublonnage.py, with the
-- service key. Not readable by the public site nor by signed-in accounts.
--
-- Applied on 2026-10-12 (Leo: go C3).
-- Rollback: drop table public.evenements_doublons;
-- (events hidden by the clean-up of existing data are restored first by the
-- script, see the table comment.)

create table if not exists public.evenements_doublons (
  id               bigint generated always as identity primary key,
  -- the kept event
  event_id         uuid not null references public.evenements(id) on delete cascade,
  -- source of the duplicate: 'openagenda', 'datatourisme', 'site:<domain>', 'casaminga'
  source           text not null,
  source_uid       text,
  source_url       text,
  -- set only when the duplicate already existed as an event (clean-up of existing data); it is then hidden
  doublon_event_id uuid references public.evenements(id) on delete set null,
  niveau           smallint not null check (niveau in (2, 3)),
  raison           text not null check (raison in ('exact', 'proche')),
  score            real,
  titre            text not null,
  debut            timestamptz not null,
  -- {field: {avant, apres}} : what the kept event took from the duplicate
  enrichi          jsonb not null default '{}'::jsonb,
  regle            text not null,
  created_at       timestamptz not null default now(),
  -- link undone (false positive); the script then never links this triplet again
  annule_le        timestamptz,
  annule_par       text
);

create unique index if not exists evenements_doublons_uniq
  on public.evenements_doublons (source, coalesce(source_uid, titre), debut)
  where annule_le is null;
create index if not exists evenements_doublons_event_idx
  on public.evenements_doublons (event_id);
create index if not exists evenements_doublons_doublon_idx
  on public.evenements_doublons (doublon_event_id) where doublon_event_id is not null;

-- Access: service_role only, like platform_tasks (0009) and annuaire_sites_sondes (0019).
-- RLS on with no policy blocks any functional access. Since 0018 a new table
-- still keeps arwd for anon and authenticated, so the nominal grants are
-- revoked explicitly instead of relying on RLS alone.
alter table public.evenements_doublons enable row level security;

revoke all on public.evenements_doublons from public, anon, authenticated;
grant select, insert, update on public.evenements_doublons to service_role;

revoke all on sequence public.evenements_doublons_id_seq from public, anon, authenticated;
grant usage, select on sequence public.evenements_doublons_id_seq to service_role;

comment on table public.evenements_doublons is
  'Duplicates between sources (R7). event_id = kept event. doublon_event_id = event hidden by the clean-up of existing data. Undo: show_on_public_site = true on doublon_event_id, restore the "avant" values of enrichi, then set annule_le.';
comment on column public.evenements_doublons.niveau is
  '2 = same normalised title, same Paris day, compatible place and time; 3 = close title (similarity >= 0.85 or contained). Levels 1 (same record) and 4 (session of a series) never create a row.';
comment on column public.evenements_doublons.regle is
  'Version of the rule that created the link (scripts/dedoublonnage.py REGLE), e.g. v1-2026-10.';
