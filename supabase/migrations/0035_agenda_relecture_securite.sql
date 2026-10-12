-- 0035_agenda_relecture_securite
-- Two minor corrections from the security review of 0030 and 0033
-- (08 Import evenements/Conception/P1-relecture-securite.md, 2026-10-12):
--   C1. agenda_compteurs_calc copied every "types" entry of p_formats; 20
--       formats of 10 000 types took 379 ms instead of 90. Capped at 30 per
--       format, like p_types in agenda_lignes.
--   C2. agenda_series read the city of the event's own establishment without
--       the active condition, so a public event pointing at a deactivated
--       place could leak its city. The join now requires ees.active.
-- Same signatures as 0033: create or replace only, rights unchanged.
-- Applied on 2026-10-12.

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
           (array(select jsonb_array_elements_text(f.value -> 'types')))[1:30] as types,
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
    left join public.establishments ees on ees.id = ev.establishment_id and ees.active
   order by t.en_cours, t.tri, t.start_at, t.id
$$;


