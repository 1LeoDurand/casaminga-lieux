-- ════════════════════════════════════════════════════════════
-- platform_tasks — feuille de route de la plateforme (/admin/roadmap)
-- ════════════════════════════════════════════════════════════
-- Volontairement SÉPARÉE de `tasks`, qui est cloisonnée par organisation :
-- la roadmap Casa Minga n'appartient à aucune association. La loger dans
-- `tasks` aurait imposé un organization_id nullable, donc un trou dans
-- l'isolation d'une table en service (23 lignes sur 14 organisations).
--
-- Les colonnes reprennent celles de `tasks` (titre, description, priorité,
-- statut, échéance) pour que le composant <TaskBoard> serve les deux vues
-- sans adaptation.

create table if not exists public.platform_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,

  -- Cinq colonnes, calées sur le flux réel : ce qui est proposé, ce qui est
  -- validé, ce qui est en cours, ce qui est codé mais pas encore déployé,
  -- ce qui est livré. La quatrième existe parce que le trou entre « commité »
  -- et « en production » est le vrai goulot d'étranglement du projet.
  status       text not null default 'a_trier'
               check (status in ('a_trier', 'valide', 'en_cours', 'a_deployer', 'fait')),

  priority     text not null default 'normale'
               check (priority in ('haute', 'normale', 'basse')),

  -- Ampleur indicative, reprise du vocabulaire de ROADMAP.md.
  effort       text check (effort in ('XS', 'S', 'M', 'L', 'XL')),

  -- Renvoi vers l'item de ROADMAP.md (ex. « B2 »), pour retrouver le détail.
  roadmap_ref  text,

  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists platform_tasks_status_idx on public.platform_tasks (status);

-- ── Accès ────────────────────────────────────────────────────
-- RLS activée SANS AUCUNE POLITIQUE : la table est donc inaccessible à
-- `anon` comme à `authenticated`, y compris en lecture. Seul `service_role`
-- la voit, car il contourne la RLS — et il n'est employé que dans le code
-- serveur, après requireSuperAdmin(). Pas de politique à maintenir, pas de
-- risque qu'une organisation aperçoive la feuille de route.
alter table public.platform_tasks enable row level security;

-- ── updated_at ───────────────────────────────────────────────
create or replace function public.platform_tasks_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists platform_tasks_touch on public.platform_tasks;
create trigger platform_tasks_touch
  before update on public.platform_tasks
  for each row execute function public.platform_tasks_touch();
