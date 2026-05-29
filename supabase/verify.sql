-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Vérification du socle (lecture seule)
-- À exécuter après 0001_init_socle.sql + seed.sql.
-- À lancer dans le SQL editor Supabase ou via psql.
-- ════════════════════════════════════════════════════════════

-- 1) Les 5 tables du socle existent-elles ?
select 'tables' as check, string_agg(table_name, ', ' order by table_name) as found
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','organizations','organization_members','public_sites','requests');
-- Attendu : organization_members, organizations, profiles, public_sites, requests

-- 2) RLS activé sur chaque table ?
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles','organizations','organization_members','public_sites','requests')
order by relname;
-- Attendu : rls_enabled = true partout

-- 3) Policies en place (compte par table) ?
select tablename, count(*) as nb_policies, string_agg(policyname, ', ' order by policyname) as policies
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','organizations','organization_members','public_sites','requests')
group by tablename
order by tablename;
-- Attendu : profiles 3, organizations 3, organization_members 2, public_sites 2, requests 2

-- 4) Seed Bernard Kohn présent ?
select 'organization' as item, count(*) as n from public.organizations where slug = 'bernard-kohn'
union all
select 'public_site (publié)', count(*) from public.public_sites where slug = 'bernard-kohn' and status = 'publie'
union all
select 'requests', count(*) from public.requests
where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
-- Attendu : organization 1, public_site 1, requests >= 3

-- 5) Membres du lieu démo (0 tant que tu ne t'es pas ajouté) :
select user_id, role, status
from public.organization_members
where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
-- Rappel : pour voir les demandes dans /dashboard/bernard-kohn (RLS),
-- il faut être connecté ET membre de l'organisation (voir seed.sql).
