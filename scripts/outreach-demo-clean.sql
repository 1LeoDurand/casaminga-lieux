-- outreach-demo-clean.sql
--
-- Removes everything scripts/outreach-demo-seed.sql (and the trials made on
-- top of it) created, and puts the module back to its starting state:
-- 4 programs (inactive), 3 mailboxes (inactive), 19 stages, 40 transitions,
-- 27 subjects, 4 settings rows, 11 red zones, 0 context, 0 thread, 0 contact.
--
-- Safety: the script REFUSES to run when it finds anything that is not demo
-- data (a contact without the 'demo' tag, or a context that does not start
-- with 'DEMO'), because it also empties the journal and the contexts.

do $clean$
begin
  if exists (select 1 from public.outreach_contacts where not ('demo' = any(tags))) then
    raise exception 'clean: real contacts present, refusing to clean';
  end if;
  if exists (select 1 from public.outreach_program_contexts where body not like 'DEMO%') then
    raise exception 'clean: a real context is present, refusing to clean';
  end if;

  -- Journal first (append-only for UPDATE, DELETE stays possible for the purge).
  delete from public.outreach_events;

  delete from public.outreach_photo_grants;                  -- on delete restrict towards threads and contacts
  delete from public.outreach_suppressions where email like '%@example.invalid';
  delete from public.outreach_threads;                       -- cascades to messages
  delete from public.outreach_contacts;                      -- cascades to addresses
  delete from public.outreach_articles;
  delete from public.outreach_program_contexts;

  -- Back to the starting values: everything inactive, nothing paused, automatic replies off.
  update public.outreach_programs set active = false where active;
  update public.outreach_mailboxes
     set active = false, paused = false, pause_reason = null, paused_at = null
   where active or paused;
  update public.outreach_settings
     set paused = false, pause_reason = null, paused_at = null, updated_by = null
   where paused or updated_by is not null;
  update public.outreach_subjects
     set auto_enabled = false, auto_enabled_at = null, auto_enabled_by = null
   where auto_enabled;
end
$clean$;
