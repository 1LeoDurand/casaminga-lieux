-- 0016_feedback_help_grants.sql
-- Privilege hygiene on feedback and the help centre tables.
--
-- Before: anon and authenticated held every table privilege (INSERT, SELECT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) on the three tables, inherited
-- from the schema default privileges. RLS blocked normal use, but TRUNCATE is
-- not subject to RLS. Grant only what the clients actually need:
--   - feedback: INSERT only (the admin feedback widget inserts from the browser
--     without .select(), so no RETURNING and no SELECT privilege needed).
--     Reading and triage go through service_role.
--   - help_articles / help_categories: SELECT only. Editing in /admin/aide goes
--     through service_role; view and vote counters go through the SECURITY
--     DEFINER functions help_increment_view and help_vote (owner postgres).
-- RLS policies are unchanged.

revoke all on table public.feedback        from anon, authenticated;
revoke all on table public.help_articles   from anon, authenticated;
revoke all on table public.help_categories from anon, authenticated;

grant insert on table public.feedback        to anon, authenticated;
grant select on table public.help_articles   to anon, authenticated;
grant select on table public.help_categories to anon, authenticated;
