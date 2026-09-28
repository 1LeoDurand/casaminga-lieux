-- Public read access to help articles is limited to published rows.
--
-- help_art_read used `using (true)`: any unpublished draft was readable by
-- anyone holding the public anon key (it ships in casaminga.com's bundle).
-- Editing goes through service_role, which bypasses RLS, so the admin editor
-- still sees drafts. help_increment_view and help_vote are SECURITY DEFINER
-- and are not affected.

drop policy if exists help_art_read on public.help_articles;

create policy help_art_read on public.help_articles
  for select
  using (published = true);
