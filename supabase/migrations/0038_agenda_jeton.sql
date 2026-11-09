-- 0038_agenda_jeton
--
-- Applied on 2026-11-10 through the Supabase connector, after a rolled-back
-- dry run on the production database. Decision T2.5 D1/D3 (Leo, 2026-11-10).
--
-- Concurrency token in front of the three public agenda functions: at most
-- 4 agenda computations run at once. A caller that finds no free slot after
-- about 250 ms gets SQLSTATE 53400, which PostgREST turns into a 503. The
-- lock is a transaction-level advisory lock: it frees itself when the call
-- ends, whatever happens. This protects the database CPU (and so the admin)
-- from a script hammering the public key; it does not protect the egress
-- quota (see 08 Import evenements/Conception/T2-5-limitation-de-debit.md).
--
-- agenda_series and agenda_epingles were `language sql`: their bodies move,
-- untouched, to agenda_series_calc and agenda_epingles_calc (same pattern as
-- agenda_compteurs / agenda_compteurs_calc), and a plpgsql wrapper with the
-- same signature takes the token first. Signatures and result types of the
-- public functions do not change.

create or replace function public.agenda_jeton()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k int;
  essai int;
begin
  for essai in 1..6 loop                 -- about 250 ms of waiting at most
    for k in 1..4 loop                   -- 4 agenda computations at once
      if pg_try_advisory_xact_lock(7300, k) then
        return;
      end if;
    end loop;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'agenda momentanément saturé' using errcode = '53400';
end;
$$;
revoke all on function public.agenda_jeton() from public, anon, authenticated;
grant execute on function public.agenda_jeton() to service_role;

-- ---------------------------------------------------------------------
-- agenda_series
-- ---------------------------------------------------------------------
alter function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text, integer, integer)
  rename to agenda_series_calc;
revoke all on function public.agenda_series_calc(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.agenda_series_calc(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text, integer, integer)
  to service_role;

create function public.agenda_series(
  p_debut timestamptz default null, p_fin timestamptz default null, p_creneau text default null,
  p_gratuit boolean default null, p_types text[] default null, p_termes_titre text[] default null,
  p_duree_min_jours integer default null, p_mots text[] default null, p_lat double precision default null,
  p_lng double precision default null, p_rayon_km integer default null, p_commune text default null,
  p_etablissement uuid default null, p_organisation uuid default null, p_en_cours text default 'apres',
  p_decalage integer default 0, p_limite integer default 24)
returns table(serie text, id uuid, organization_id uuid, establishment_id uuid, title text, type text, start_at timestamptz, end_at timestamptz, price numeric, photos text[], capacity integer, nb_seances integer, dates timestamptz[], en_cours boolean, heure_inconnue boolean, lat double precision, lng double precision, commune text, lieu_nom text, org_name text, org_slug text, org_source text, org_claimed_at timestamptz, org_primary_color text, total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.agenda_jeton();
  return query
    select * from public.agenda_series_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre, p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km, p_commune, p_etablissement, p_organisation, p_en_cours, p_decalage, p_limite);
end;
$$;
revoke all on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text, integer, integer)
  from public;
grant execute on function public.agenda_series(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- agenda_epingles
-- ---------------------------------------------------------------------
alter function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text)
  rename to agenda_epingles_calc;
revoke all on function public.agenda_epingles_calc(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.agenda_epingles_calc(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text)
  to service_role;

create function public.agenda_epingles(
  p_debut timestamptz default null, p_fin timestamptz default null, p_creneau text default null,
  p_gratuit boolean default null, p_types text[] default null, p_termes_titre text[] default null,
  p_duree_min_jours integer default null, p_mots text[] default null, p_lat double precision default null,
  p_lng double precision default null, p_rayon_km integer default null, p_commune text default null,
  p_etablissement uuid default null, p_organisation uuid default null, p_en_cours text default 'apres')
returns table(establishment_id uuid, nom text, commune text, lat double precision, lng double precision, nb bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.agenda_jeton();
  return query
    select * from public.agenda_epingles_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre, p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km, p_commune, p_etablissement, p_organisation, p_en_cours);
end;
$$;
revoke all on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text)
  from public;
grant execute on function public.agenda_epingles(timestamptz, timestamptz, text, boolean, text[], text[], integer, text[], double precision, double precision, integer, text, uuid, uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- agenda_compteurs: already plpgsql, takes the token first. Body otherwise
-- identical to 0035 (one token covers its up to three _calc passes).
-- ---------------------------------------------------------------------
create or replace function public.agenda_compteurs(
  p_debut timestamptz default null, p_fin timestamptz default null, p_creneau text default null,
  p_gratuit boolean default null, p_types text[] default null, p_termes_titre text[] default null,
  p_duree_min_jours integer default null, p_mots text[] default null, p_lat double precision default null,
  p_lng double precision default null, p_rayon_km integer default null, p_commune text default null,
  p_etablissement uuid default null, p_organisation uuid default null, p_en_cours text default 'apres',
  p_moments jsonb default null, p_formats jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v jsonb; v_quoi jsonb := 'null'::jsonb; v_lieu jsonb := 'null'::jsonb;
begin
  perform public.agenda_jeton();
  v := public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre, p_duree_min_jours, p_mots, p_lat, p_lng, p_rayon_km, p_commune, p_etablissement, p_organisation, p_en_cours, p_moments, p_formats);
  if coalesce((v ->> 'total')::bigint, 0) = 0 then
    if coalesce(cardinality(p_mots), 0) > 0 then v_quoi := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre, p_duree_min_jours, null, p_lat, p_lng, p_rayon_km, p_commune, p_etablissement, p_organisation, p_en_cours, null, null) -> 'total', '0'::jsonb); end if;
    if p_lat is not null or coalesce(p_commune, '') <> '' then v_lieu := coalesce(public.agenda_compteurs_calc(p_debut, p_fin, p_creneau, p_gratuit, p_types, p_termes_titre, p_duree_min_jours, p_mots, null, null, null, null, p_etablissement, p_organisation, p_en_cours, null, null) -> 'total', '0'::jsonb); end if;
  end if;
  return jsonb_set(coalesce(v, '{}'::jsonb), '{retraits}', coalesce(v -> 'retraits', '{}'::jsonb) || jsonb_build_object('quoi', v_quoi, 'lieu', v_lieu));
end
$$;
