-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Migration socle (v1)
-- Multi-tenant : organization_id sur toutes les tables métier, RLS partout.
-- Tables : profiles · organizations · organization_members · public_sites · requests
-- ════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Helper updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Rôles métier (par organisation) ─────────────────────────
do $$ begin
  create type public.org_role as enum (
    'admin', 'coord', 'comm', 'finance', 'benevole', 'intervenant', 'readonly'
  );
exception when duplicate_object then null;
end $$;

-- ════════════════════════════════════════════════════════════
-- PROFILES — un par utilisateur auth
-- ════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- ORGANIZATIONS — les lieux (multi-tenant)
-- ════════════════════════════════════════════════════════════
create table if not exists public.organizations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  structure      text,
  siret          text,
  address        text,
  email          text,
  phone          text,
  website        text,
  description    text,
  hours          text,
  plan           text not null default 'essentiel',
  primary_color  text not null default '#FF8A65',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_orgs_updated on public.organizations;
create trigger trg_orgs_updated before update on public.organizations
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ORGANIZATION_MEMBERS — lien user ↔ organisation + rôle/zones
-- ════════════════════════════════════════════════════════════
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            public.org_role not null default 'readonly',
  zones           text[] not null default '{}',
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id, organization_id);

-- Helper : l'utilisateur courant est-il membre de cette organisation ?
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

-- ════════════════════════════════════════════════════════════
-- PUBLIC_SITES — config du site public généré par lieu
-- ════════════════════════════════════════════════════════════
create table if not exists public.public_sites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug            text not null,
  title           text not null,
  content_blocks  jsonb not null default '[]'::jsonb,
  status          text not null default 'brouillon',  -- brouillon | publie
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

drop trigger if exists trg_public_sites_updated on public.public_sites;
create trigger trg_public_sites_updated before update on public.public_sites
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- REQUESTS — demandes entrantes (pont site public → dashboard)
-- ════════════════════════════════════════════════════════════
create table if not exists public.requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text,
  email            text,
  phone            text,
  organization_ext text,
  type             text,
  status           text not null default 'nouvelle', -- nouvelle|etudier|attente|validee|refusee|archivee
  priority         text not null default 'normale',
  summary          text,
  message          text,
  assignee_id      uuid references public.profiles(id),
  received_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_requests_org_status on public.requests(organization_id, status);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.public_sites         enable row level security;
alter table public.requests             enable row level security;

-- PROFILES : chacun gère son propre profil
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ORGANIZATIONS : membres lisent leurs orgs ; lecture publique si site publié
create policy "orgs_select_member" on public.organizations
  for select using (public.is_org_member(id));
create policy "orgs_select_public" on public.organizations
  for select using (
    exists (select 1 from public.public_sites ps
            where ps.organization_id = organizations.id and ps.status = 'publie')
  );
create policy "orgs_update_admin" on public.organizations
  for update using (
    exists (select 1 from public.organization_members m
            where m.organization_id = organizations.id
              and m.user_id = auth.uid()
              and m.role in ('admin', 'coord'))
  );

-- ORGANIZATION_MEMBERS : membres voient les membres de leurs orgs
create policy "members_select" on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy "members_manage_admin" on public.organization_members
  for all using (
    exists (select 1 from public.organization_members m
            where m.organization_id = organization_members.organization_id
              and m.user_id = auth.uid()
              and m.role = 'admin')
  );

-- PUBLIC_SITES : lecture anonyme des sites publiés ; gestion réservée aux membres
create policy "public_sites_select_published" on public.public_sites
  for select using (status = 'publie');
create policy "public_sites_member_all" on public.public_sites
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- REQUESTS : membres = accès complet ; insertion anonyme depuis un site publié
create policy "requests_member_all" on public.requests
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "requests_insert_from_public_site" on public.requests
  for insert with check (
    exists (select 1 from public.public_sites ps
            where ps.organization_id = requests.organization_id and ps.status = 'publie')
  );
