-- ════════════════════════════════════════════════════════════
-- platform — la plateforme devient une colonne
-- ════════════════════════════════════════════════════════════
-- admin.casaminga.com reste le seul poste de pilotage : chaque plateforme
-- (admin / public / sejour) obtient sa vue via une colonne `platform` sur les
-- tables déjà en service (feedback, platform_tasks, help_articles,
-- help_categories), plutôt qu'un back office dupliqué par site.
--
-- Additive uniquement, idempotente : toutes les lignes existantes valent
-- 'admin', ce qui est vrai (le widget de feedback de l'admin, la roadmap et
-- l'aide n'ont servi jusqu'ici que l'admin).

-- ── feedback ─────────────────────────────────────────────────
alter table public.feedback
  add column if not exists platform text not null default 'admin';

alter table public.feedback
  drop constraint if exists feedback_platform_check;
alter table public.feedback
  add constraint feedback_platform_check
  check (platform in ('admin', 'public', 'sejour'));

-- Courriel tapé par un visiteur anonyme depuis le widget public, distinct de
-- `user_email` qui vient de l'authentification de l'admin.
alter table public.feedback
  add column if not exists reporter_email text;

create index if not exists feedback_platform_status_idx
  on public.feedback (platform, status);

-- ── platform_tasks ───────────────────────────────────────────
alter table public.platform_tasks
  add column if not exists platform text not null default 'admin';

alter table public.platform_tasks
  drop constraint if exists platform_tasks_platform_check;
alter table public.platform_tasks
  add constraint platform_tasks_platform_check
  check (platform in ('admin', 'public', 'sejour'));

-- Nature de la carte, pour distinguer un bug remonté d'un contenu à écrire.
-- Nullable : les cartes existantes n'ont pas cette information.
alter table public.platform_tasks
  add column if not exists kind text;

alter table public.platform_tasks
  drop constraint if exists platform_tasks_kind_check;
alter table public.platform_tasks
  add constraint platform_tasks_kind_check
  check (kind is null or kind in ('bug', 'amelioration', 'article', 'contenu', 'decision'));

create index if not exists platform_tasks_platform_status_idx
  on public.platform_tasks (platform, status);

-- ── help_categories / help_articles ──────────────────────────
-- Public : associations (l'existant). Admin : particuliers (à venir,
-- prompt 7). Toutes les catégories et articles actuels servent l'admin.
alter table public.help_categories
  add column if not exists audience text not null default 'admin';

alter table public.help_categories
  drop constraint if exists help_categories_audience_check;
alter table public.help_categories
  add constraint help_categories_audience_check
  check (audience in ('admin', 'public'));

alter table public.help_articles
  add column if not exists audience text not null default 'admin';

alter table public.help_articles
  drop constraint if exists help_articles_audience_check;
alter table public.help_articles
  add constraint help_articles_audience_check
  check (audience in ('admin', 'public'));
