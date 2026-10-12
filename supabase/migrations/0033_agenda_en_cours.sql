-- 0033_agenda_en_cours
-- Follow-up of 0030 (C1). Since the agenda reads on the server, every
-- rendez-vous already started (an exhibition running for months: 188 of 3 613
-- series) had tri = greatest(start_at, window start) = window start, so all of
-- them came first in /agenda and in the home blocks "Aujourd'hui" and "Ce
-- week-end". New parameter p_en_cours text default 'apres', on the five
-- functions:
--   'apres'    (default) running rows stay in the list but sort AFTER the
--              rendez-vous that start inside the window
--              (order by en_cours, tri, start_at, id);
--   'exclure'  running rows leave the list, the pins and the counters;
--   'seulement' only running rows.
-- "Running" = started before the window opens (or before now, when the window
-- opens in the past), not over yet. Any other value counts as 'apres'.
-- The counters also return en_cours (number of running series with the other
-- filters in place) and retraits.en_cours (total without the running
-- criterion), for the "En ce moment (188)" chip and its empty state.
--
-- Overloads: create or replace with a new signature would create a SECOND
-- function and PostgREST would answer "could not choose the best candidate".
-- The five old signatures (0030) are therefore dropped first, then every
-- function is recreated and every REVOKE and GRANT is repeated (rule of 0018:
-- a new function has no EXECUTE for anon or authenticated unless granted).
--
-- Nothing in the data changes. Rollback: rerun the function section of 0030
-- (drop the five new signatures first).

drop function if exists public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, int, int);
drop function if exists public.agenda_compteurs(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, jsonb, jsonb);
drop function if exists public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid);
drop function if exists public.agenda_compteurs_calc(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, jsonb, jsonb);
drop function if exists public.agenda_lignes(timestamptz, timestamptz, boolean, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid);

-- =====================================================================
-- Internal: agenda_lignes (rows after every filter, running mode included).
-- =====================================================================
create or replace function public.agenda_lignes(
  p_debut timestamptz, p_fin timestamptz, p_garde boolean,
  p_creneau text, p_gratuit boolean,
  p_types text[], p_termes_titre text[], p_duree_min_jours int,
  p_mots text[],
  p_lat double precision, p_lng double precision, p_rayon_km int,
  p_commune text, p_etablissement uuid, p_organisation uuid,
  p_en_cours text default 'apres'
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
     -- running = started before the window opens (par.borne); any value other
     -- than 'exclure' or 'seulement' keeps every row
     and (p_en_cours is distinct from 'exclure' or e.start_at >= par.borne)
     and (p_en_cours is distinct from 'seulement' or e.start_at < par.borne)
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
  text[], double precision, double precision, int, text, uuid, uuid, text) from public, anon, authenticated;

-- =====================================================================
-- Internal: agenda_compteurs_calc (one pass, counters per option).
-- =====================================================================
create or replace function public.agenda_compteurs_calc(
  p_debut timestamptz, p_fin timestamptz,
  p_creneau text, p_gratuit boolean,
  p_types text[], p_termes_titre text[], p_duree_min_jours int,
  p_mots text[],
  p_lat double precision, p_lng double precision, p_rayon_km int,
  p_commune text, p_etablissement uuid, p_organisation uuid,
  p_en_cours text,
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
           (p_types is not null or p_termes_titre is not null or p_duree_min_jours is not null) as actif,
           -- running rows filter; any other value than these two keeps them all
           case when p_en_cours in ('exclure', 'seulement') then p_en_cours else 'apres' end as mode
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
      p_commune, p_etablissement, p_organisation, 'apres')
  ),
  -- Base flags per window (b_*) and "running when the window opens" (e_*), the
  -- same rule as agenda_lignes (started before greatest(now, window start)).
  f0 as (
    select l.serie, l.type, l.titre_pad, l.duree_jours, l.creneau, l.price,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.cd, w.cf), false) as b_cur,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.dd, w.df), false) as b_def,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.aj_d, w.aj_f), false) as b_aj,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.we_d, w.we_f), false) as b_we,
           coalesce(public.agenda_fenetre_ok(l.start_at, l.end_at, w.se_d, w.se_f), false) as b_se,
           l.start_at < greatest(now(), w.cd) as e_cur,
           l.start_at < now() as e_def,
           l.start_at < greatest(now(), w.aj_d) as e_aj,
           l.start_at < greatest(now(), w.we_d) as e_we,
           l.start_at < greatest(now(), w.se_d) as e_se,
           (not fc.actif
            or public.agenda_format_ok(l.type, l.titre_pad, l.duree_jours, (p_types)[1:30], fc.motifs, p_duree_min_jours)) as fm,
           (coalesce(p_creneau, '') = '' or l.creneau = p_creneau) as cr,
           (p_gratuit is not true or l.price = 0) as gr
      from l cross join w cross join fcur fc
  ),
  -- w_*: the window with the running mode applied ('exclure' drops the running
  -- rows, 'seulement' keeps only them).
  f as (
    select f0.*,
           (f0.b_cur and (fc.mode <> 'exclure' or not f0.e_cur) and (fc.mode <> 'seulement' or f0.e_cur)) as w_cur,
           (f0.b_def and (fc.mode <> 'exclure' or not f0.e_def) and (fc.mode <> 'seulement' or f0.e_def)) as w_def,
           (f0.b_aj and (fc.mode <> 'exclure' or not f0.e_aj) and (fc.mode <> 'seulement' or f0.e_aj)) as w_aj,
           (f0.b_we and (fc.mode <> 'exclure' or not f0.e_we) and (fc.mode <> 'seulement' or f0.e_we)) as w_we,
           (f0.b_se and (fc.mode <> 'exclure' or not f0.e_se) and (fc.mode <> 'seulement' or f0.e_se)) as w_se
      from f0 cross join fcur fc
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
           -- running series with the other filters in place, whatever the mode
           bool_or(f.b_cur and f.e_cur and f.fm and f.cr and f.gr) as q_ec,
           bool_or(f.b_cur and f.fm and f.cr and f.gr) as r_encours,
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
    'en_cours', count(*) filter (where s.q_ec),
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
      'gratuit', count(*) filter (where s.r_gratuit),
      'en_cours', count(*) filter (where s.r_encours))
  )
  from s
$$;

revoke all on function public.agenda_compteurs_calc(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

-- =====================================================================
-- E. agenda_series: one page of rendez-vous (series), with the total.
--    Series = organization + title (case and spaces folded), like
--    groupSessions. Filters apply BEFORE grouping, pagination AFTER.
--    Order: running rows last ('apres'), then start of the first session
--    inside the window, then its start, then id: a total order, so two pages
--    never overlap. Within a series the same order picks the representative
--    session: a series with a running session AND an upcoming one is
--    represented by the upcoming one (the running one then comes last in
--    dates). p_limite is capped at 60, p_decalage floored at 0.
-- =====================================================================
create or replace function public.agenda_series(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null,
  p_en_cours text default 'apres',
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
                                       p_commune, p_etablissement, p_organisation, p_en_cours)
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
    window w as (partition by b.serie order by b.en_cours, b.tri, b.start_at, b.id)
  ),
  t as (
    select g.*, count(*) over () as total_series
      from g
     where g.rn = 1
     order by g.en_cours, g.tri, g.start_at, g.id
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
   order by t.en_cours, t.tri, t.start_at, t.id
$$;


-- =====================================================================
-- agenda_epingles: one pin per geolocated place (as 0030, plus p_en_cours).
-- =====================================================================
create or replace function public.agenda_epingles(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null,
  p_en_cours text default 'apres'
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
                                p_commune, p_etablissement, p_organisation, p_en_cours) b
     where b.lat is not null and b.lng is not null
     group by b.establishment_id, b.lat, b.lng
  )
  select g.establishment_id, est.name, est.city, g.lat, g.lng, g.nb
    from g
    left join public.establishments est on est.id = g.establishment_id
   order by g.nb desc, g.establishment_id
$$;

-- =====================================================================
-- agenda_compteurs: the exposed counters (as 0030, plus p_en_cours).
-- =====================================================================
create or replace function public.agenda_compteurs(
  p_debut timestamptz default null, p_fin timestamptz default null,
  p_creneau text default null, p_gratuit boolean default null,
  p_types text[] default null, p_termes_titre text[] default null, p_duree_min_jours int default null,
  p_mots text[] default null,
  p_lat double precision default null, p_lng double precision default null, p_rayon_km int default null,
  p_commune text default null, p_etablissement uuid default null, p_organisation uuid default null,
  p_en_cours text default 'apres',
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
         p_organisation, p_en_cours, p_moments, p_formats);

  if coalesce((v ->> 'total')::bigint, 0) = 0 then
    if coalesce(cardinality(p_mots), 0) > 0 then
      v_quoi := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types,
           p_termes_titre, p_duree_min_jours, null, p_lat, p_lng, p_rayon_km, p_commune,
           p_etablissement, p_organisation, p_en_cours, null, null) -> 'total', '0'::jsonb);
    end if;
    if p_lat is not null or coalesce(p_commune, '') <> '' then
      v_lieu := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types,
           p_termes_titre, p_duree_min_jours, p_mots, null, null, null, null, p_etablissement,
           p_organisation, p_en_cours, null, null) -> 'total', '0'::jsonb);
    end if;
  end if;

  return jsonb_set(coalesce(v, '{}'::jsonb), '{retraits}',
           coalesce(v -> 'retraits', '{}'::jsonb) || jsonb_build_object('quoi', v_quoi, 'lieu', v_lieu));
end
$$;

-- =====================================================================
-- Rights. Only the three exposed functions are callable by the site.
-- (Default privileges of Supabase grant EXECUTE to anon and authenticated on
-- every new function: hence the explicit revokes. agenda_lignes and
-- agenda_compteurs_calc are revoked above, right after their creation.)
-- =====================================================================
revoke all on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text, int, int)
  from public, anon, authenticated;
grant execute on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text, int, int)
  to anon, authenticated, service_role;

revoke all on function public.agenda_compteurs(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.agenda_compteurs(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text, jsonb, jsonb)
  to anon, authenticated, service_role;

revoke all on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], int,
  text[], double precision, double precision, int, text, uuid, uuid, text)
  to anon, authenticated, service_role;
