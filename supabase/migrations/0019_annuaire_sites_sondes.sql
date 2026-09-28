-- ════════════════════════════════════════════════════════════
-- annuaire_sites_sondes — mémoire du moissonneur de sites (prompt 2.4)
-- ════════════════════════════════════════════════════════════
-- Le moissonneur (scripts/import-sites.py) essaie, pour chaque tiers-lieu de
-- l'annuaire ayant un site, l'API The Events Calendar, un flux ICS, puis du
-- JSON-LD schema.org. Beaucoup de sites n'ont rien de tout ça : les resonder
-- à chaque passage serait à la fois lent et impoli (un appel par site quand
-- même). Cette table retient, par tiers-lieu, ce qui a été trouvé la dernière
-- fois, pour ne resonder un site muet qu'après un délai (90 jours, décidé
-- côté script).
--
-- Comme platform_tasks (migration 0009) : RLS activée SANS AUCUNE POLITIQUE,
-- et sans le moindre GRANT à anon ni authenticated. Seul le script d'import,
-- qui écrit avec la clé de service (service_role, qui contourne la RLS), y
-- touche. Rien ici n'est un besoin du portail public ni de l'admin : c'est de
-- la plomberie d'import.
--
-- Depuis 0018_cash_access_hardening.sql, les privilèges par défaut du schéma
-- public gardent encore SELECT/INSERT/UPDATE/DELETE pour anon et authenticated
-- sur une table neuve (seuls TRUNCATE/REFERENCES/TRIGGER/MAINTAIN en ont été
-- retirés) : la RLS sans politique bloque déjà tout accès fonctionnel, mais un
-- REVOKE explicite ci-dessous retire aussi le droit nominal, par prudence et
-- pour que cette table ne dépende d'aucun autre mécanisme que le sien.

create table if not exists public.annuaire_sites_sondes (
  annuaire_id    uuid primary key references public.annuaire_lieux(id) on delete cascade,

  -- Copie du site sondé au moment du sondage, normalisé (le script corrige les
  -- "https://HTTPS://…" et ajoute "https://" quand le protocole manque). Sert
  -- de repère de relecture ; la valeur qui fait foi reste annuaire_lieux.site_web.
  site_web       text,

  sonde_le       timestamptz not null default now(),

  -- Ce qui a été trouvé, dans l'ordre d'essai du script : l'API The Events
  -- Calendar, un flux ICS, du JSON-LD schema.org, rien d'exploitable, ou une
  -- erreur (site injoignable, robots.txt qui refuse, HTML illisible).
  signal         text not null check (signal in ('tribe', 'ics', 'jsonld', 'aucun', 'erreur')),

  -- URL du flux ou de la page où le signal a été trouvé (endpoint tribe, .ics,
  -- page portant le JSON-LD). Null si signal = 'aucun' ou 'erreur'.
  url_flux       text,

  nb_evenements  int not null default 0,

  -- Détail de l'échec, si signal = 'erreur' (code HTTP, robots.txt, timeout).
  erreur         text
);

comment on table public.annuaire_sites_sondes is
  'Mémoire du moissonneur de sites (scripts/import-sites.py) : dernier signal trouvé par tiers-lieu de l''annuaire, pour espacer les resondages.';
comment on column public.annuaire_sites_sondes.signal is
  'tribe = API The Events Calendar ; ics = flux ICS ; jsonld = JSON-LD schema.org Event ; aucun = rien d''exploitable trouvé ; erreur = site injoignable ou refusé.';

create index if not exists annuaire_sites_sondes_sonde_le_idx
  on public.annuaire_sites_sondes (sonde_le);

-- ── Accès : service_role seul, comme platform_tasks ─────────────
alter table public.annuaire_sites_sondes enable row level security;

revoke all on public.annuaire_sites_sondes from anon, authenticated;

-- ── updated_at implicite : sonde_le sert déjà cet usage ─────────
-- (pas de colonne updated_at séparée : chaque sondage réécrit sonde_le)
