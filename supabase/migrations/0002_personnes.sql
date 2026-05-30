-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Migration v1.5 : Personnes (CRM du lieu)
-- Idempotente : ré-exécutable via le SQL Editor (« appliquer OU vérifier »).
-- Multi-tenant : organization_id + RLS adossée à is_org_member().
-- Dépend de : 0001_init_socle.sql (organizations, is_org_member, set_updated_at).
-- ════════════════════════════════════════════════════════════

-- ── Table PERSONS ───────────────────────────────────────────
create table if not exists public.persons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  role            text not null default 'membre',   -- membre|coworker|benevole|intervenant|resident|partenaire|equipe|prospect
  status          text not null default 'actif',    -- actif | inactif
  tags            text[] not null default '{}',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_persons_org       on public.persons(organization_id, status);
create index if not exists idx_persons_org_role   on public.persons(organization_id, role);

drop trigger if exists trg_persons_updated on public.persons;
create trigger trg_persons_updated before update on public.persons
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────
alter table public.persons enable row level security;

-- Membres de l'organisation = accès complet (lecture + écriture).
-- Aucune lecture publique : le CRM ne sort jamais du périmètre de l'équipe.
drop policy if exists "persons_member_all" on public.persons;
create policy "persons_member_all" on public.persons
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
