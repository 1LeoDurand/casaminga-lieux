-- 0023_help_audience_sejour
--
-- Applied on 2026-09-30 with Léo's approval.
--
-- Opens the help centre tables to a third audience, 'sejour', so that
-- sejour.casaminga.com can read its own help articles from this database
-- (plan: PLAN-CENTRE-AIDE-2026-09-30.md, option A).
--
-- State before this migration:
--   * help_categories.audience and help_articles.audience are limited to
--     ('admin', 'public') by a CHECK constraint (0015_platform).
--   * anon and authenticated hold SELECT only on both tables (0016).
--   * RLS: help_cat_read is `using (true)`, help_art_read is
--     `using (published = true)` (0017). Neither filters on audience, so
--     'sejour' rows are readable with no policy change.
--   * Counters go through two SECURITY DEFINER RPCs, executable by anon and
--     authenticated (0018): help_increment_view(p_slug) and
--     help_vote(p_slug, p_helpful). They updated ANY slug, drafts included,
--     which let an anonymous caller probe for unpublished slugs and inflate
--     draft counters.
--
-- This migration:
--   1. extends both CHECK constraints to ('admin', 'public', 'sejour');
--   2. redefines the two RPCs so that they only touch published rows, with
--      search_path pinned to public, pg_temp; signatures unchanged, so the
--      admin (/aide) and the public sites keep calling them as before;
--   3. adds an index on help_articles (audience, published, slug) for the
--      per-audience listing queries.
--
-- Abuse protection is deliberately minimal in v1: any anonymous caller can
-- still increment a published article's counters as often as they like (no
-- rate limit, no per-visitor dedup). Counters are indicative, not a metric
-- anything depends on.

begin;

-- 1. Audience 'sejour' ------------------------------------------------------
alter table public.help_categories
  drop constraint if exists help_categories_audience_check;
alter table public.help_categories
  add constraint help_categories_audience_check
  check (audience in ('admin', 'public', 'sejour'));

alter table public.help_articles
  drop constraint if exists help_articles_audience_check;
alter table public.help_articles
  add constraint help_articles_audience_check
  check (audience in ('admin', 'public', 'sejour'));

-- 2. Counter RPCs: published rows only --------------------------------------
create or replace function public.help_increment_view(p_slug text)
  returns void
  language sql
  security definer
  set search_path = public, pg_temp
as $$
  update public.help_articles
     set view_count = view_count + 1
   where slug = p_slug
     and published = true;
$$;

create or replace function public.help_vote(p_slug text, p_helpful boolean)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if p_helpful is null then
    return;
  end if;
  if p_helpful then
    update public.help_articles
       set helpful_yes = helpful_yes + 1
     where slug = p_slug and published = true;
  else
    update public.help_articles
       set helpful_no = helpful_no + 1
     where slug = p_slug and published = true;
  end if;
end;
$$;

-- CREATE OR REPLACE keeps the existing ACL; restated here so the file is
-- self-sufficient.
revoke all on function public.help_increment_view(text)     from public;
revoke all on function public.help_vote(text, boolean)      from public;
grant execute on function public.help_increment_view(text)  to anon, authenticated, service_role;
grant execute on function public.help_vote(text, boolean)   to anon, authenticated, service_role;

-- 3. Index -------------------------------------------------------------------
create index if not exists help_articles_audience_published_slug_idx
  on public.help_articles (audience, published, slug);

commit;
