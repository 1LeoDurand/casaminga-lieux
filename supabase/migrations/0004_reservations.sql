-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Migration v1.7 : Réservations (créneaux d'espaces)
-- Idempotente : ré-exécutable via le SQL Editor (« appliquer OU vérifier »).
-- Multi-tenant : organization_id + RLS adossée à is_org_member().
-- Dépend de : 0001_init_socle.sql (organizations, is_org_member, set_updated_at),
--             0002_personnes.sql (persons), 0003_espaces.sql (spaces).
-- ════════════════════════════════════════════════════════════

-- ── Table RESERVATIONS ──────────────────────────────────────
create table if not exists public.reservations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  space_id        uuid not null references public.spaces(id) on delete cascade,
  person_id       uuid references public.persons(id) on delete set null,
  title           text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  status          text not null default 'demandee',   -- demandee | confirmee | terminee | annulee
  price           numeric(10,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reservations_time_order check (end_at > start_at)
);

create index if not exists idx_reservations_org        on public.reservations(organization_id, status);
create index if not exists idx_reservations_org_space   on public.reservations(organization_id, space_id, start_at);
create index if not exists idx_reservations_org_start   on public.reservations(organization_id, start_at);

drop trigger if exists trg_reservations_updated on public.reservations;
create trigger trg_reservations_updated before update on public.reservations
  for each row execute function public.set_updated_at();

-- ── Anti-chevauchement (défense en profondeur) ──────────────
-- Empêche deux réservations NON annulées de se chevaucher sur le même espace.
-- Bornes [start, end) : 14h–16h et 16h–18h ne se chevauchent pas.
-- Nécessite l'extension btree_gist (incluse dans Supabase).
create extension if not exists btree_gist;

alter table public.reservations
  drop constraint if exists reservations_no_overlap;
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    space_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'annulee');

-- ── Row Level Security ──────────────────────────────────────
alter table public.reservations enable row level security;

-- Membres de l'organisation = accès complet (lecture + écriture).
drop policy if exists "reservations_member_all" on public.reservations;
create policy "reservations_member_all" on public.reservations
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
