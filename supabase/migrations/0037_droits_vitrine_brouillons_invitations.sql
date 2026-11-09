-- 0037_droits_vitrine_brouillons_invitations
--
-- Applied on 2026-11-10 through the Supabase connector (one transaction),
-- after a rolled-back dry run on the production database.
-- Decisions: T2.5 D4 and T2.6 (Leo, 2026-11-10).
--
-- Four independent hardenings of what the public key and plain accounts
-- can do. Nothing here touches service_role nor the agenda RPCs (owned by
-- postgres, they bypass RLS).

-- =====================================================================
-- 1. Client roles lose TRUNCATE, TRIGGER, REFERENCES and MAINTAIN.
--    TRUNCATE ignores RLS; MAINTAIN (PG17) allows LOCK TABLE, REINDEX,
--    VACUUM. PostgREST never issues any of them. select/insert/update/
--    delete are untouched.
-- =====================================================================
revoke truncate, trigger, references, maintain
  on all tables in schema public
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;

-- =====================================================================
-- 2. An event is public only if its organization has a published
--    vitrine, as in agenda_lignes (0030). 13 events of 8 organizations
--    without a vitrine stop being readable directly (they were already
--    absent from the agenda).
-- =====================================================================
alter policy evenements_public_read on public.evenements
  using (
    status in ('publie', 'confirme', 'planifie')
    and show_on_public_site
    and exists (
      select 1
        from public.public_sites ps
       where ps.organization_id = evenements.organization_id
         and ps.status = 'publie'
    )
  );

-- =====================================================================
-- 3. evenements_read gave SELECT on every event, drafts and withdrawn
--    ones included, to any signed-in account (auth.role() =
--    'authenticated'). Members read their organization through
--    evenements_member_all, visitors through evenements_public_read:
--    what remains is the platform staff, same test as evenements_write.
-- =====================================================================
alter policy evenements_read on public.evenements
  using (
    public.is_super_admin()
    or exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.role = 'editeur'
         and 'evenements' = any (p.zones)
    )
  );

-- =====================================================================
-- 4. invitations_public_read (using true, role public) let anyone holding
--    the public key list every invitation: email, role and the token that
--    grants membership. Every public read of an invitation goes through
--    the service role (api/invitations/[token], rejoindre/[token],
--    revendication); the team screen reads as an organization admin
--    through invitations_manage_admin. Nothing needs the public policy.
--    anon keeps no privilege at all on the table.
-- =====================================================================
drop policy if exists invitations_public_read on public.invitations;
revoke all on table public.invitations from anon;
