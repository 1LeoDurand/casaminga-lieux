-- 0018_cash_access_hardening.sql
-- Cash register (NF525) access hardening and function grants.
-- Source: AUDIT-CAISSE-FONCTIONS-2026-09-28.md (proposal 0018_v2_9_function_grants_hardening),
-- amended with Leo's decisions of 2026-09-28:
--   * cash access (add entry, close, void, verify, read entries/closures)
--     = active member AND (role 'admin' OR perm_caisse = true);
--   * role 'finance' gets perm_caisse ticked by default (backfill + UI);
--   * server-side timestamp/operator: NOT now. The body of cash_add_entry
--     (certified hash payload) is left untouched.
-- Applied through the Supabase connector, which wraps it in a transaction.

-- =====================================================================
-- A. Remove ambiguous overloads (roadmap item B3).
--    voidCashEntry then resolves to the 14-param cash_add_entry.
--    Hash payload is identical in both versions: existing entries unaffected.
-- =====================================================================
drop function if exists public.cash_add_entry(
  uuid, text, numeric, numeric, text, text, text, text, boolean, bigint, timestamptz, uuid);
-- Unused 3-param close (closeCashRegister always sends 5 named args).
drop function if exists public.cash_close(uuid, text, text);

-- =====================================================================
-- B. Per-member cash permission.
-- =====================================================================
alter table public.organization_members
  add column if not exists perm_caisse boolean not null default false;

-- Finance members get it by default (0 rows on 2026-09-28).
update public.organization_members
  set perm_caisse = true
  where role = 'finance' and perm_caisse = false;

-- The column default was 'active' while every row and every guard uses
-- 'actif': a member inserted without an explicit status would silently
-- lose cash access. Align the default with the actual vocabulary.
alter table public.organization_members alter column status set default 'actif';

-- =====================================================================
-- C. Single access rule, used by both the RPC guard and the RLS policies.
--    SECURITY INVOKER: the caller only reads their own membership row
--    (allowed by members_select); inside SECURITY DEFINER cash functions
--    it runs as postgres and bypasses RLS.
-- =====================================================================
create or replace function public.cash_has_access(p_org uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.organization_members m
       where m.organization_id = p_org
         and m.user_id = auth.uid()
         and m.status = 'actif'
         and (m.role = 'admin' or m.perm_caisse)
     );
$$;

-- Guard called first by cash_add_entry, cash_close and cash_verify.
-- Signature unchanged so the certified bodies need no edit.
create or replace function public.cash_assert_member(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Accès refusé : authentification requise.' using errcode = '42501';
  end if;
  if not public.cash_has_access(p_org) then
    raise exception 'Accès refusé : vous n''avez pas accès à la caisse de cette structure.'
      using errcode = '42501';
  end if;
end;
$$;

-- =====================================================================
-- D. Cash tables: writes to the certified ledger only through the
--    SECURITY DEFINER functions (owned by postgres, which bypasses RLS).
-- =====================================================================
revoke all on public.cash_entries, public.cash_closures,
              public.cash_pointings, public.cash_register_settings from anon;

revoke insert, update, delete, truncate, references, trigger, maintain
  on public.cash_entries, public.cash_closures from authenticated;
-- Pointings (bank reconciliation, outside the hash chain) and settings keep
-- arwd for authenticated, filtered by RLS below.
revoke truncate, references, trigger, maintain
  on public.cash_pointings, public.cash_register_settings from authenticated;

drop policy if exists cash_entries_org on public.cash_entries;
drop policy if exists cash_entries_select on public.cash_entries;
create policy cash_entries_select on public.cash_entries
  for select to authenticated
  using (public.cash_has_access(organization_id));

drop policy if exists cash_closures_org on public.cash_closures;
drop policy if exists cash_closures_select on public.cash_closures;
create policy cash_closures_select on public.cash_closures
  for select to authenticated
  using (public.cash_has_access(organization_id));

drop policy if exists cash_pointings_select on public.cash_pointings;
drop policy if exists cash_pointings_write on public.cash_pointings;
drop policy if exists cash_pointings_access on public.cash_pointings;
create policy cash_pointings_access on public.cash_pointings
  for all to authenticated
  using (public.cash_has_access(organization_id))
  with check (public.cash_has_access(organization_id));

-- Settings: read needs cash access; write stays admin-only (cash_settings_upsert).
drop policy if exists cash_settings_select on public.cash_register_settings;
create policy cash_settings_select on public.cash_register_settings
  for select to authenticated
  using (public.cash_has_access(organization_id));

-- TRUNCATE bypasses row triggers: statement-level guard.
drop trigger if exists cash_entries_no_truncate on public.cash_entries;
create trigger cash_entries_no_truncate before truncate on public.cash_entries
  for each statement execute function public.cash_block_mutation();
drop trigger if exists cash_closures_no_truncate on public.cash_closures;
create trigger cash_closures_no_truncate before truncate on public.cash_closures
  for each statement execute function public.cash_block_mutation();

-- =====================================================================
-- E. Function grants, one by one.
-- =====================================================================
-- E1. Cash and invoicing RPCs: authenticated + service_role only.
revoke all on function public.cash_add_entry(
  uuid, text, numeric, numeric, text, text, text, text, boolean, bigint, timestamptz, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.cash_add_entry(
  uuid, text, numeric, numeric, text, text, text, text, boolean, bigint, timestamptz, uuid, uuid, uuid)
  to authenticated, service_role;

revoke all on function public.cash_close(uuid, text, text, numeric, numeric) from public, anon;
grant execute on function public.cash_close(uuid, text, text, numeric, numeric) to authenticated, service_role;

revoke all on function public.cash_verify(uuid) from public, anon;
grant execute on function public.cash_verify(uuid) to authenticated, service_role;

revoke all on function public.assign_invoice_number(uuid) from public, anon;
grant execute on function public.assign_invoice_number(uuid) to authenticated, service_role;

revoke all on function public.assign_receipt_number(uuid, integer) from public, anon;
grant execute on function public.assign_receipt_number(uuid, integer) to authenticated, service_role;

-- E2. Access rule: evaluated by the RLS policies above (TO authenticated).
revoke all on function public.cash_has_access(uuid) from public, anon;
grant execute on function public.cash_has_access(uuid) to authenticated, service_role;

-- E3. Internal guards: only called from SECURITY DEFINER bodies (run as postgres).
revoke all on function public.cash_assert_member(uuid) from public, anon, authenticated;
revoke all on function public.org_assert_member(uuid)  from public, anon, authenticated;
grant execute on function public.cash_assert_member(uuid) to service_role;
grant execute on function public.org_assert_member(uuid)  to service_role;

-- E4. RLS helpers: MUST stay executable by anon (policies are TO public and
--     casaminga.com reads those tables as anon). Implicit PUBLIC grant
--     replaced by explicit ones; semantics unchanged.
revoke all on function public.is_super_admin()      from public;
revoke all on function public.is_org_admin(uuid)    from public;
revoke all on function public.is_org_member(uuid)   from public;
revoke all on function public.shares_org_with(uuid) from public;
grant execute on function public.is_super_admin()      to anon, authenticated, service_role;
grant execute on function public.is_org_admin(uuid)    to anon, authenticated, service_role;
grant execute on function public.is_org_member(uuid)   to anon, authenticated, service_role;
grant execute on function public.shares_org_with(uuid) to anon, authenticated, service_role;

-- E5. Intended public RPCs (help centre).
revoke all on function public.help_increment_view(text) from public;
revoke all on function public.help_vote(text, boolean)  from public;
grant execute on function public.help_increment_view(text) to anon, authenticated, service_role;
grant execute on function public.help_vote(text, boolean)  to anon, authenticated, service_role;

-- E6. Trigger functions: never callable as RPC (EXECUTE is only checked at
--     CREATE TRIGGER time, existing triggers keep firing).
revoke all on function public.handle_login()             from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
revoke all on function public.platform_tasks_touch()     from public, anon, authenticated;

-- =====================================================================
-- F. super_admins: no longer world-readable. Only read by is_org_member
--    (SECURITY DEFINER), no code reads it.
-- =====================================================================
drop policy if exists super_admins_read on public.super_admins;
drop policy if exists super_admins_read_self on public.super_admins;
create policy super_admins_read_self on public.super_admins
  for select to authenticated using (user_id = auth.uid());
revoke all on public.super_admins from anon;
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.super_admins from authenticated;

-- =====================================================================
-- G. Default privileges for FUTURE objects created by postgres
--    (migrations, SQL editor, MCP). Every new RPC or table now needs an
--    explicit GRANT in its migration.
-- =====================================================================
-- G1. Built-in PUBLIC EXECUTE on functions can only be removed globally.
alter default privileges for role postgres
  revoke execute on functions from public;
-- G2. Supabase per-schema defaults granting anon/authenticated.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- G3. Tables: keep arwd (the RLS model relies on it), drop what PostgREST never uses.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
-- service_role keeps its defaults. supabase_admin defaults cannot be changed
-- from here (postgres is not a member of supabase_admin).
