-- 0030_agenda_lecture_serveur
-- Public agenda read by date window: filters, series grouping, counters and
-- map pins computed server side. Design: 08 Import evenements/Conception/
-- P1-agenda-fenetre-de-dates.md (drafted as 0027, renumbered 0030 because
-- 0027_annuaire_ecolieu.sql already exists).
--
-- Additive: no column is added to an admin table. What is created:
--   * 1 table   evenements_recherche (normalized search text, own table)
--   * 2 triggers (evenements, organizations) that keep it current
--   * 2 partial indexes (evenements, establishments)
--   * 3 exposed functions (agenda_series, agenda_compteurs, agenda_epingles)
--     and 6 internal ones, never executable by anon or authenticated.
--
-- Rights (rule of 0018/0020): a new function has NO EXECUTE for anon or
-- authenticated unless granted below, a new table keeps arwd for the client
-- roles unless revoked below. Every REVOKE and GRANT is explicit.
--
-- The exposed functions are security definer and write the public conditions
-- themselves, in hard: show_on_public_site, a published status, and an
-- organization whose technical public site is published (mirror of
-- orgs_select_public). No parameter relaxes them.
--
-- Applied on 2026-10-12 (Leo: go C1). Dry run: scripts/essai-migration-0030.py
-- (single transaction, always rolled back).
--
-- Rollback (nothing existing is modified):
--   drop function agenda_series, agenda_compteurs, agenda_epingles,
--     agenda_compteurs_calc, agenda_lignes, agenda_format_ok,
--     agenda_motifs, agenda_fenetre_ok, evenements_recherche_maj,
--     texte_normalise;
--   drop trigger evenements_recherche_evt on evenements;
--   drop trigger evenements_recherche_org on organizations;
--   drop table evenements_recherche;
--   drop index evenements_public_fin_idx, establishments_coords_idx;

-- =====================================================================
-- A. Text normalization, same shape as normalizeSearch (portal-search.ts):
--    lower case, accents removed (precomposed, and combining marks U+0300 to
--    U+036F), anything outside a-z0-9 becomes a space.
--    oe and ae ligatures are NOT mapped: NFD does not decompose them, so the
--    client turns them into a space and this function must do the same.
-- =====================================================================
create or replace function public.texte_normalise(t text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(t, ''),
        'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸāăąćčďēėęěğīįńňōőřśšşťūůűźżžĀĂĄĆČĎĒĖĘĚĞĪĮŃŇŌŐŘŚŠŞŤŪŮŰŹŻŽ',
        'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyyaaaccdeeeegiinnoorssstuuuzzzaaaccdeeeegiinnoorssstuuuzzz')),
      '[\u0300-\u036f]', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

revoke all on function public.texte_normalise(text) from public, anon, authenticated;
grant execute on function public.texte_normalise(text) to service_role;

-- =====================================================================
-- B. Search text, in a table of its own (the portal never widens an admin
--    table). Read only by the security definer functions below.
-- =====================================================================
create table if not exists public.evenements_recherche (
  event_id uuid primary key references public.evenements(id) on delete cascade,
  texte    text not null,
  -- normalized title padded with spaces, for whole word matching of formats
  titre_pad text not null,
  -- series key (organization + title, case and spaces folded), as groupSessions
  serie    text collate "C" not null,
  maj_le   timestamptz not null default now()
);

alter table public.evenements_recherche enable row level security;
-- No policy on purpose: anon and authenticated cannot read it at all.
revoke all on public.evenements_recherche from public, anon, authenticated;
grant select, insert, update, delete on public.evenements_recherche to service_role;

create or replace function public.evenements_recherche_maj()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'evenements' then
    insert into public.evenements_recherche (event_id, texte, titre_pad, serie, maj_le)
    select new.id,
           public.texte_normalise(new.title || ' ' || coalesce(new.description, '') || ' ' || coalesce(o.name, '')),
           ' ' || public.texte_normalise(new.title) || ' ',
           new.organization_id::text || '|' || lower(regexp_replace(btrim(new.title), '\s+', ' ', 'g')),
           now()
      from public.organizations o
     where o.id = new.organization_id
    on conflict (event_id) do update
      set texte = excluded.texte, titre_pad = excluded.titre_pad, serie = excluded.serie, maj_le = now();
  else
    update public.evenements_recherche r
       set texte = public.texte_normalise(e.title || ' ' || coalesce(e.description, '') || ' ' || coalesce(new.name, '')),
           maj_le = now()
      from public.evenements e
     where e.id = r.event_id
       and e.organization_id = new.id;
  end if;
  return new;
end
$$;

revoke all on function public.evenements_recherche_maj() from public, anon, authenticated;

drop trigger if exists evenements_recherche_evt on public.evenements;
create trigger evenements_recherche_evt
  after insert or update of title, description, organization_id on public.evenements
  for each row execute function public.evenements_recherche_maj();

drop trigger if exists evenements_recherche_org on public.organizations;
create trigger evenements_recherche_org
  after update of name on public.organizations
  for each row when (old.name is distinct from new.name)
  execute function public.evenements_recherche_maj();

-- Initial fill.
insert into public.evenements_recherche (event_id, texte, titre_pad, serie)
select e.id,
       public.texte_normalise(e.title || ' ' || coalesce(e.description, '') || ' ' || coalesce(o.name, '')),
       ' ' || public.texte_normalise(e.title) || ' ',
       e.organization_id::text || '|' || lower(regexp_replace(btrim(e.title), '\s+', ' ', 'g'))
  from public.evenements e
  join public.organizations o on o.id = e.organization_id
on conflict (event_id) do nothing;

-- =====================================================================
-- C. Partial indexes on public rows.
-- =====================================================================
create index if not exists evenements_public_fin_idx
  on public.evenements (end_at, start_at)
  where show_on_public_site and status in ('publie', 'confirme', 'planifie');

create index if not exists establishments_coords_idx
  on public.establishments (latitude, longitude)
  where active and latitude is not null and longitude is not null;

-- =====================================================================
-- D. Internal helpers (never exposed).
-- =====================================================================

-- agenda_fenetre_ok and agenda_format_ok carry no "set search_path" on purpose:
-- a SQL function with a SET clause cannot be inlined, and these two run once
-- per row and per option in the counters (measured: 530 ms -> 110 ms). Their
-- bodies use built-in operators only and are not callable by any client role.
-- A rendez-vous is listed when it is not over (end_at) and starts before the
-- window ends. One running for more than 90 days only shows with a short
-- window (8 days or less): otherwise a few long exhibitions would sit at the
-- head of the default list every day.
create or replace function public.agenda_fenetre_ok(
  p_start timestamptz, p_end timestamptz, p_debut timestamptz, p_fin timestamptz
) returns boolean
language sql
stable
as $$
  select p_end >= greatest(now(), p_debut)
     and p_start < p_fin
     and (p_start >= now() - interval '90 days' or p_fin - p_debut <= interval '8 days')
$$;

-- Title terms as LIKE patterns on a padded normalized title: whole words only,
-- so that "art" does not match "depart". Normalization strips % and _.
create or replace function public.agenda_motifs(p_termes text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array(
    select '% ' || w || ' %'
      from unnest((p_termes)[1:40]) t,
           lateral (select public.texte_normalise(left(t, 60)) as w) n
     where n.w <> ''
  )
$$;

-- Same rule as matchesEvent for a format: type, or long enough, or a term in
-- the title.
create or replace function public.agenda_format_ok(
  p_type text, p_titre_pad text, p_duree int,
  p_types text[], p_motifs text[], p_duree_min int
) returns boolean
language sql
immutable
as $$
  select coalesce(p_type = any (p_types), false)
      or (p_duree_min is not null and p_duree >= p_duree_min)
      or (coalesce(cardinality(p_motifs), 0) > 0 and p_titre_pad like any (p_motifs))
$$;

-- Public rows in the window, with their place, after every filter. Shared by
-- the three exposed functions. Deliberately narrow (no title, no organization
-- columns): the exposed functions read those for the 24 rows of a page only,
-- instead of copying them for every row of the catalogue.
--   p_garde: apply the 90 days rule (false for the counters, which apply it
--            per window afterwards and pass no slot, free or format filter).
--   Format filter: active when any of p_types, p_termes_titre or
--            p_duree_min_jours is given (same rule as matchesEvent).
create or replace function public.agenda_lignes(
  p_debut timestamptz, p_fin timestamptz, p_garde boolean,
  p_creneau text, p_gratuit boolean,
  p_types text[], p_termes_titre text[], p_duree_min_jours int,
  p_mots text[],
  p_lat double precision, p_lng double precision, p_rayon_km int,
  p_commune text, p_etablissement uuid, p_organisation uuid
) returns table (
  id uuid, organization_id uuid, establishment_id uuid, type text,
  start_at timestamptz, end_at timestamptz, price numeric,
  serie text, tri timestamptz, en_cours boolean, heure_inconnue boolean,
  lat double precision, lng double precision,
  creneau text, titre_pad text, duree_jours int
)
language sql
stable
security definer
set search_path = public, pg_temp
-- Inside a function the planner sees the parameters as unknown and underrates
-- the number of rows: it picks nested loops over public_sites and
-- establishments (measured: 14 million comparisons at 18 000 rows, 3 s
-- instead of 0.15 s). The side tables are tiny, so hash joins are always right.
set enable_nestloop = off
as $$
  -- MATERIALIZED: otherwise the planner folds par into the row filters and
  -- rebuilds the format patterns (a regex each) for every row.
  with par as materialized (
    select d.debut,
           least(coalesce(p_fin, d.debut + interval '12 months'),
                 d.debut + case when p_garde then interval '400 days' else interval '3660 days' end) as fin,
           greatest(now(), d.debut) as borne,
           -- radius snapped up to an allowed value
           coalesce((select min(v) from unnest('{5,10,20,50,100}'::int[]) v where v >= coalesce(p_rayon_km, 20)), 100) as rayon,
           coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false) as centre,
           array(select distinct w
                   from unnest((p_mots)[1:8]) m,
                        regexp_split_to_table(public.texte_normalise(left(m, 80)), ' ') w
                  where length(w) between 2 and 40) as mots,
           array(select w from regexp_split_to_table(public.texte_normalise(left(p_commune, 80)), ' ') w
                  where w <> '') as mots_commune,
           public.texte_normalise(left(p_commune, 80)) as commune_n,
           (p_types is not null or p_termes_titre is not null or p_duree_min_jours is not null) as fmt_actif,
           public.agenda_motifs(p_termes_titre) as motifs
      from (select coalesce(p_debut, now()) as debut) d
  ),
  -- Active establishments; the normalized city only when a place is asked
  -- for by name (otherwise it costs a regex per row).
  etab as materialized (
    select x.id, x.organization_id, x.is_primary, x."position", x.latitude, x.longitude,
           case when par.commune_n <> '' then public.texte_normalise(x.city) end as city_n
      from public.establishments x
     cross join par
     where x.active
  ),
  -- First geolocated establishment of each organization (rule of
  -- indexCoordsOrg), else any active one.
  lieu_org as (
    select distinct on (x.organization_id)
           x.organization_id, x.id, x.latitude, x.longitude, x.city_n
      from etab x
     order by x.organization_id,
              (x.latitude is null or x.longitude is null),
              x.is_primary desc, x."position", x.id
  ),
  orgn as materialized (
    select o.id,
           case when cardinality(par.mots_commune) > 0 and not par.centre
                then public.texte_normalise(o.address) end as addr_n
      from public.organizations o
     cross join par
  )
  select e.id, e.organization_id, lc.etab_id, e.type, e.start_at, e.end_at, e.price,
         coalesce(r.serie, (e.organization_id::text || '|' || lower(regexp_replace(btrim(e.title), '\s+', ' ', 'g'))) collate "C"),
         greatest(e.start_at, par.debut),
         e.start_at < par.borne,
         hr.inconnue,
         lc.lat, lc.lng,
         case when hr.inconnue then null
              when hr.heure < 12 then 'matin'
              when hr.heure < 18 then 'apres-midi'
              else 'soir' end,
         tp.pad,
         hr.duree
    from par
    cross join public.evenements e
    join orgn on orgn.id = e.organization_id
    left join etab es on es.id = e.establishment_id
    left join lieu_org lo on lo.organization_id = e.organization_id
    left join public.evenements_recherche r on r.event_id = e.id
    cross join lateral (select (es.latitude is not null and es.longitude is not null) as eg) g
    cross join lateral (
      select case when g.eg then es.latitude else lo.latitude end as lat,
             case when g.eg then es.longitude else lo.longitude end as lng,
             coalesce(case when g.eg then es.id end, lo.id, es.id) as etab_id,
             coalesce(es.city_n, lo.city_n) as cn
    ) lc
    cross join lateral (
      select extract(hour from e.start_at at time zone 'Europe/Paris')::int as heure,
             -- "all day" rows (midnight to 23:58 or later, Paris time)
             ((e.start_at at time zone 'Europe/Paris')::time = time '00:00'
              and (e.end_at at time zone 'Europe/Paris')::time >= time '23:58') as inconnue,
             ((e.end_at at time zone 'Europe/Paris')::date - (e.start_at at time zone 'Europe/Paris')::date) as duree
    ) hr
    cross join lateral (
      select coalesce(r.titre_pad, ' ' || public.texte_normalise(e.title) || ' ') as pad
    ) tp
   where e.show_on_public_site
     and e.status in ('publie', 'confirme', 'planifie')
     and exists (select 1 from public.public_sites ps
                  where ps.organization_id = e.organization_id and ps.status = 'publie')
     and e.end_at >= par.borne
     and e.start_at < par.fin
     and (not p_garde
          or e.start_at >= now() - interval '90 days'
          or par.fin - par.debut <= interval '8 days')
     and (p_organisation is null or e.organization_id = p_organisation)
     and (p_etablissement is null or lc.etab_id = p_etablissement)
     and (coalesce(p_creneau, '') = ''
          or (case when hr.inconnue then null
                   when hr.heure < 12 then 'matin'
                   when hr.heure < 18 then 'apres-midi'
                   else 'soir' end) = p_creneau)
     and (p_gratuit is not true or e.price = 0)
     and (not par.fmt_actif
          or public.agenda_format_ok(e.type, tp.pad, hr.duree, (p_types)[1:30], par.motifs, p_duree_min_jours))
     and (cardinality(par.mots) = 0
          or (r.texte is not null
              and not exists (select 1 from unnest(par.mots) m where r.texte not like '%' || m || '%')))
     and (case
            when par.centre then
              -- chosen place with a centre: distance when the row has
              -- coordinates, else the commune must equal the chosen name
              case when lc.lat is not null and lc.lng is not null then
                     lc.lat between p_lat - par.rayon / 111.0 and p_lat + par.rayon / 111.0
                     and lc.lng between p_lng - par.rayon / (111.0 * greatest(cos(radians(p_lat)), 0.01))
                                    and p_lng + par.rayon / (111.0 * greatest(cos(radians(p_lat)), 0.01))
                     and 2 * 6371 * asin(least(1, sqrt(
                           power(sin(radians(lc.lat - p_lat) / 2), 2)
                         + cos(radians(p_lat)) * cos(radians(lc.lat))
                         * power(sin(radians(lc.lng - p_lng) / 2), 2)))) <= par.rayon
                   else lc.cn is not null and lc.cn = par.commune_n
              end
            when cardinality(par.mots_commune) > 0 then
              -- old link without a centre: every word of the place in the
              -- commune or the organization address (cityMatches)
              not exists (select 1 from unnest(par.mots_commune) w
                           where position(w in coalesce(lc.cn, '') || ' ' || coalesce(orgn.addr_n, '')) = 0)
            else true
          end)
$$;

revoke all on function public.agenda_lignes(timestamptz, timestamptz, boolean, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid) from public, anon, authenticated;

-- =====================================================================
-- E. Exposed function 1: one page of rendez-vous (series), with the total.
--    Series = organization + title (case and spaces folded), like
--    groupSessions. Filters apply BEFORE grouping, pagination AFTER.
--    Order: start of the first session inside the window, then its start,
--    then id: a total order, so two pages never overlap.
--    p_limite is capped at 60, p_decalage floored at 0.
--    Within a series, order by (tri, start_at, id) equals order by start_at:
--    tri is monotonic in start_at.
-- =====================================================================
create or replace function public.agenda_series(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null,
  p_decalage int default 0, p_limite int default 24
) returns table (
  serie text, id uuid, organization_id uuid, establishment_id uuid, title text, type text,
  start_at timestamptz, end_at timestamptz, price numeric, photos text[], capacity int,
  nb_seances int, dates timestamptz[], en_cours boolean, heure_inconnue boolean,
  lat double precision, lng double precision, commune text, lieu_nom text,
  org_name text, org_slug text, org_source text, org_claimed_at timestamptz, org_primary_color text,
  total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with b as (
    select * from public.agenda_lignes(p_debut, p_fin, true, p_creneau, p_gratuit, p_types, p_termes_titre,
                                       p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km,
                                       p_commune, p_etablissement, p_organisation)
  ),
  -- One sort, then window functions over that order: rn = 1 is the
  -- representative session, nb the session count, ds its first six dates
  -- (frame current row .. 5 following keeps the arrays at six elements).
  g as (
    select b.*,
           row_number() over w as rn,
           count(*) over (partition by b.serie) as nb,
           array_agg(b.start_at) over (w rows between current row and 5 following) as ds
      from b
    window w as (partition by b.serie order by b.tri, b.start_at, b.id)
  ),
  t as (
    select g.*, count(*) over () as total_series
      from g
     where g.rn = 1
     order by g.tri, g.start_at, g.id
    offset greatest(coalesce(p_decalage, 0), 0)
     limit least(greatest(coalesce(p_limite, 24), 1), 60)
  )
  select t.serie, t.id, t.organization_id, t.establishment_id, ev.title, t.type,
         t.start_at, t.end_at, t.price, ev.photos, ev.capacity,
         t.nb::int, t.ds, t.en_cours, t.heure_inconnue,
         t.lat, t.lng, coalesce(ees.city, est.city), est.name,
         o.name, o.slug, o.source, o.claimed_at, o.primary_color,
         t.total_series
    from t
    join public.evenements ev on ev.id = t.id
    join public.organizations o on o.id = t.organization_id
    left join public.establishments est on est.id = t.establishment_id
    left join public.establishments ees on ees.id = ev.establishment_id
   order by t.tri, t.start_at, t.id
$$;

-- =====================================================================
-- F. Exposed function 3: one pin per geolocated place, with the number of
--    rendez-vous (series) that pass the filters. The detail of a pin is read
--    on click with agenda_series(p_etablissement => ...).
-- =====================================================================
create or replace function public.agenda_epingles(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null
) returns table (
  establishment_id uuid, nom text, commune text,
  lat double precision, lng double precision, nb bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with g as (
    select b.establishment_id, b.lat, b.lng, count(distinct b.serie) as nb
      from public.agenda_lignes(p_debut, p_fin, true, p_creneau, p_gratuit, p_types, p_termes_titre,
                                p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km,
                                p_commune, p_etablissement, p_organisation) b
     where b.lat is not null and b.lng is not null
     group by b.establishment_id, b.lat, b.lng
  )
  select g.establishment_id, est.name, est.city, g.lat, g.lng, g.nb
    from g
    left join public.establishments est on est.id = g.establishment_id
   order by g.nb desc, g.establishment_id
$$;

-- =====================================================================
-- G. Counters. One pass over the public rows of the widest window, then for
--    each series a bool_or per option: "how many cards if this option were
--    chosen, the other filters staying". The window is the current one
--    (p_debut, p_fin) plus the three moments of p_moments, a jsonb object
--      {"aujourdhui": {"debut": ts, "fin": ts}, "weekend": {...}, "semaine": {...}}
--    p_formats is a jsonb array of at most 20 entries
--      [{"id": "ateliers", "types": [...], "termes": [...], "duree_min_jours": null}, ...]
--    so that PORTAL_FORMATS stays defined once, in TypeScript.
-- =====================================================================
create or replace function public.agenda_compteurs_calc(
  p_debut timestamptz, p_fin timestamptz,
  p_creneau text, p_gratuit boolean,
  p_types text[], p_termes_titre text[], p_duree_min_jours int,
  p_mots text[],
  p_lat double precision, p_lng double precision, p_rayon_km int,
  p_commune text, p_etablissement uuid, p_organisation uuid,
  p_moments jsonb, p_formats jsonb
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with w as materialized (
    select c.cd,
           least(coalesce(p_fin, c.cd + interval '12 months'), c.cd + interval '400 days') as cf,
           now() as dd,
           now() + interval '12 months' as df,
           m.aj_d, m.aj_f, m.we_d, m.we_f, m.se_d, m.se_f
      from (select coalesce(p_debut, now()) as cd) c
      cross join lateral (
        select case when jsonb_typeof(p_moments) = 'object' then (p_moments -> 'aujourdhui' ->> 'debut')::timestamptz end as aj_d,
               case when jsonb_typeof(p_moments) = 'object' then least((p_moments -> 'aujourdhui' ->> 'fin')::timestamptz,
                    (p_moments -> 'aujourdhui' ->> 'debut')::timestamptz + interval '400 days') end as aj_f,
               case when jsonb_typeof(p_moments) = 'object' then (p_moments -> 'weekend' ->> 'debut')::timestamptz end as we_d,
               case when jsonb_typeof(p_moments) = 'object' then least((p_moments -> 'weekend' ->> 'fin')::timestamptz,
                    (p_moments -> 'weekend' ->> 'debut')::timestamptz + interval '400 days') end as we_f,
               case when jsonb_typeof(p_moments) = 'object' then (p_moments -> 'semaine' ->> 'debut')::timestamptz end as se_d,
               case when jsonb_typeof(p_moments) = 'object' then least((p_moments -> 'semaine' ->> 'fin')::timestamptz,
                    (p_moments -> 'semaine' ->> 'debut')::timestamptz + interval '400 days') end as se_f
      ) m
  ),
  fcur as materialized (
    select public.agenda_motifs(p_termes_titre) as motifs,
           (p_types is not null or p_termes_titre is not null or p_duree_min_jours is not null) as actif
  ),
  fo as materialized (
    select f.value ->> 'id' as id, f.ord,
           array(select jsonb_array_elements_text(f.value -> 'types')) as types,
           public.agenda_motifs(array(select jsonb_array_elements_text(f.value -> 'termes'))) as motifs,
           case when jsonb_typeof(f.value -> 'duree_min_jours') = 'number'
                then (f.value ->> 'duree_min_jours')::int end as dmin
      from jsonb_array_elements(case when jsonb_typeof(p_formats) = 'array' then p_formats else '[]'::jsonb end)
           with ordinality f(value, ord)
     where f.ord <= 20 and f.value ->> 'id' is not null
  ),
  l as (
    select * from public.agenda_lignes(
      (select least(w.cd, w.dd, w.aj_d, w.we_d, w.se_d) from w),
      (select greatest(w.cf, w.df, w.aj_f, w.we_f, w.se_f) from w),
      false, null, null, null, null, null, p_mots, p_lat, p_lng, p_rayon_km,
      p_commune, p_etablissement, p_organisation)
  ),
  f as (
    select l.serie, l.type, l.titre_pad, l.duree_jours, l.creneau, l.price,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.cd, w.cf), false) as w_cur,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.dd, w.df), false) as w_def,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.aj_d, w.aj_f), false) as w_aj,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.we_d, w.we_f), false) as w_we,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.se_d, w.se_f), false) as w_se,
           (not fc.actif
            or public.agenda_format_ok(l.type, l.titre_pad, l.duree_jours, (p_types)[1:30], fc.motifs, p_duree_min_jours)) as fm,
           (coalesce(p_creneau, '') = '' or l.creneau = p_creneau) as cr,
           (p_gratuit is not true or l.price = 0) as gr
      from l cross join w cross join fcur fc
  ),
  -- Which formats each row matches, as a bit mask (bit ord-1), only for the
  -- rows that pass the other current filters: one pass instead of one per format.
  fm as (
    select f.*,
           case when f.w_cur and f.cr and f.gr then
             coalesce((select sum(1 << (fo.ord - 1)::int)::int
                         from fo
                        where public.agenda_format_ok(f.type, f.titre_pad, f.duree_jours, fo.types, fo.motifs, fo.dmin)), 0)
             else 0 end as fmask
      from f
  ),
  s as (
    select f.serie,
           bool_or(f.w_cur and f.fm and f.cr and f.gr) as tot,
           bool_or(f.w_aj and f.fm and f.cr and f.gr) as q_aj,
           bool_or(f.w_we and f.fm and f.cr and f.gr) as q_we,
           bool_or(f.w_se and f.fm and f.cr and f.gr) as q_se,
           bool_or(f.w_cur and f.fm and f.gr and f.creneau = 'matin') as c_ma,
           bool_or(f.w_cur and f.fm and f.gr and f.creneau = 'apres-midi') as c_ap,
           bool_or(f.w_cur and f.fm and f.gr and f.creneau = 'soir') as c_so,
           bool_or(f.w_cur and f.fm and f.cr and f.price = 0) as g_opt,
           bool_or(f.w_def and f.fm and f.cr and f.gr) as r_quand,
           bool_or(f.w_cur and f.cr and f.gr) as r_format,
           bool_or(f.w_cur and f.fm and f.gr) as r_creneau,
           bool_or(f.w_cur and f.fm and f.cr) as r_gratuit,
           bit_or(f.fmask) as fmask
      from fm f
     group by f.serie
  )
  select jsonb_build_object(
    'total', count(*) filter (where s.tot),
    'quand', jsonb_build_object(
      'aujourdhui', count(*) filter (where s.q_aj),
      'weekend', count(*) filter (where s.q_we),
      'semaine', count(*) filter (where s.q_se)),
    'creneau', jsonb_build_object(
      'matin', count(*) filter (where s.c_ma),
      'apres-midi', count(*) filter (where s.c_ap),
      'soir', count(*) filter (where s.c_so)),
    'gratuit', count(*) filter (where s.g_opt),
    'format', coalesce((
      select jsonb_object_agg(fo.id, (select count(*) from s s2 where (s2.fmask & (1 << (fo.ord - 1)::int)) <> 0))
        from fo), '{}'::jsonb),
    'retraits', jsonb_build_object(
      'quand', count(*) filter (where s.r_quand),
      'format', count(*) filter (where s.r_format),
      'creneau', count(*) filter (where s.r_creneau),
      'gratuit', count(*) filter (where s.r_gratuit))
  )
  from s
$$;

revoke all on function public.agenda_compteurs_calc(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;

-- =====================================================================
-- H. Exposed function 2: the counters. Two removals change the row set itself
--    (free text, place); each costs one more pass, so they are computed only
--    when the answer is empty (total = 0), the only case where the empty
--    state needs them. Result:
--      {total, quand:{...}, format:{...}, creneau:{...}, gratuit,
--       retraits:{quand, quoi, format, creneau, gratuit, lieu}}
--    "retraits.x" = total without the criterion x, for the empty state.
--    retraits.quoi and retraits.lieu are null when total > 0 or when the
--    criterion is not active.
-- =====================================================================
create or replace function public.agenda_compteurs(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null,
  p_moments jsonb default null, p_formats jsonb default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_quoi jsonb := 'null'::jsonb;
  v_lieu jsonb := 'null'::jsonb;
begin
  v := public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre,
         p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km, p_commune, p_etablissement,
         p_organisation, p_moments, p_formats);

  if coalesce((v ->> 'total')::bigint, 0) = 0 then
    if coalesce(cardinality(p_mots), 0) > 0 then
      v_quoi := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types,
           p_termes_titre, p_duree_min_jours, null, p_lat, p_lng, p_rayon_km, p_commune,
           p_etablissement, p_organisation, null, null) -> 'total', '0'::jsonb);
    end if;
    if p_lat is not null or coalesce(p_commune, '') <> '' then
      v_lieu := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types,
           p_termes_titre, p_duree_min_jours, p_mots, null, null, null, null, p_etablissement,
           p_organisation, null, null) -> 'total', '0'::jsonb);
    end if;
  end if;

  return jsonb_set(coalesce(v, '{}'::jsonb), '{retraits}',
           coalesce(v -> 'retraits', '{}'::jsonb) || jsonb_build_object('quoi', v_quoi, 'lieu', v_lieu));
end
$$;

-- =====================================================================
-- I. Rights. Only the three exposed functions are callable by the site.
--    (Default privileges of Supabase grant EXECUTE to anon and authenticated
--    on every new function: hence the explicit revokes above and below.)
-- =====================================================================
revoke all on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, int, int)
  from public, anon, authenticated;
grant execute on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, int, int)
  to anon, authenticated, service_role;

revoke all on function public.agenda_compteurs(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.agenda_compteurs(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, jsonb, jsonb)
  to anon, authenticated, service_role;

revoke all on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid)
  to anon, authenticated, service_role;

-- Internal helpers: no client role.
revoke all on function public.agenda_fenetre_ok(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.agenda_motifs(text[]) from public, anon, authenticated;
revoke all on function public.agenda_format_ok(text, text, int, text[], text[], int)
  from public, anon, authenticated;
