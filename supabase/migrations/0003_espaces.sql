-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Migration v1.6 : Espaces (catalogue du lieu)
-- Idempotente : ré-exécutable via le SQL Editor (« appliquer OU vérifier »).
-- Multi-tenant : organization_id + RLS adossée à is_org_member().
-- Dépend de : 0001_init_socle.sql (organizations, is_org_member, set_updated_at).
-- ════════════════════════════════════════════════════════════

-- ── Table SPACES ────────────────────────────────────────────
create table if not exists public.spaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  type            text not null default 'salle',       -- salle|atelier|bureau|exterieur|commun
  capacity        integer,                              -- nb de personnes
  area            numeric(8,2),                         -- surface en m²
  price_hour      numeric(10,2),                        -- tarif horaire (€)
  price_day       numeric(10,2),                        -- tarif journalier (€)
  description     text,
  photos          text[] not null default '{}',         -- URLs (Storage à venir)
  status          text not null default 'disponible',  -- disponible | maintenance | masque
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_spaces_org        on public.spaces(organization_id, status);
create index if not exists idx_spaces_org_type    on public.spaces(organization_id, type);

drop trigger if exists trg_spaces_updated on public.spaces;
create trigger trg_spaces_updated before update on public.spaces
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────
alter table public.spaces enable row level security;

-- Membres de l'organisation = accès complet (lecture + écriture).
-- (La lecture publique du catalogue se fera plus tard via le Site public.)
drop policy if exists "spaces_member_all" on public.spaces;
create policy "spaces_member_all" on public.spaces
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
