-- 0020_organizations_secrets
--
-- Close read access to the HelloAsso API credentials stored on
-- public.organizations.
--
-- Before this migration, anon and authenticated held a table-level SELECT on
-- organizations, and the RLS policy orgs_select_public exposes every
-- organization that has a published public site. The anon key ships in the
-- casaminga.com bundle, so anyone could read helloasso_client_secret.
--
-- Why the table-level grant is revoked first: in PostgreSQL a column-level
-- REVOKE has no effect while the role still holds the privilege on the whole
-- table. The table privilege is therefore replaced by a column list that
-- leaves out the two credential columns.
--
-- Consequences for callers:
--   * `select *` (PostgREST `select=*`, supabase-js `.select()` or
--     `.select("*")`) by anon or authenticated now fails entirely with
--     "permission denied", it does not silently drop the hidden columns.
--     Session code must select an explicit column list (see
--     getOrganizationBySlug in src/lib/data.ts). Embeds such as
--     `organizations(*)` fail the same way.
--   * The credentials are read and written server side only, through the
--     service role client, after an org admin check.
--   * A column added to organizations later is NOT readable by anon or
--     authenticated until it is added to the grants below.
--
-- stripe_account_id stays readable: the public site pages and the dashboard
-- read it with the anon or session client to decide whether online payment
-- is available. It is a connected account identifier, not a secret.
--
-- Applied on the remote database (version 20260929141054), verified 2026-09-29.

begin;

revoke select on public.organizations from anon, authenticated;

grant select (
  id, slug, name, structure, siret, address, email, phone, website,
  description, hours, plan, primary_color, created_at, updated_at,
  helloasso_org_slug, helloasso_connected_at,
  org_type, is_demo, demo_archetype,
  onboarding_j3_sent_at, onboarding_j7_sent_at,
  stripe_account_id, stripe_connected_at, stripe_charges_enabled,
  source, claimed_at
) on public.organizations to anon, authenticated;

-- Writes to the credentials go through the service role only. anon has no
-- UPDATE policy on organizations, so it loses nothing it could use.
revoke update on public.organizations from anon, authenticated;

grant update (
  slug, name, structure, siret, address, email, phone, website,
  description, hours, plan, primary_color, updated_at,
  helloasso_org_slug, helloasso_connected_at,
  org_type, is_demo, demo_archetype,
  onboarding_j3_sent_at, onboarding_j7_sent_at,
  stripe_account_id, stripe_connected_at, stripe_charges_enabled,
  source, claimed_at
) on public.organizations to authenticated;

-- TRUNCATE ignores RLS; no client role needs it, nor TRIGGER or REFERENCES.
revoke truncate, trigger, references on public.organizations from anon, authenticated;

commit;
