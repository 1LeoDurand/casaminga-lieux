-- 0031_import_retraits
--
-- One-gesture withdrawal on request (R3, R12) for imported organizations and
-- directory places. Design: 08 Import evenements/Conception/P2-retrait-en-un-geste.md
-- (numbered 0028 there; 0027 is taken and 0030 is reserved for P1).
-- Reversible, nothing is deleted: a withdrawal is a journal row, the state of
-- each touched row is photographed before it changes, and lifting the
-- withdrawal puts the photograph back.
--
-- Contents: texte_normalise (helper), 3 tables, 1 view, 2 functions, and a
-- tightened RLS policy on evenements (section F, behaviour change, see there).
--
-- NOT applied yet.
--
-- Grants follow 0018 and 0020: a new function has no EXECUTE for anon or
-- authenticated, a new table keeps arwd, so every grant and revoke below is
-- explicit. Only service_role can reach the tables, the view and the functions.
--
-- No begin/commit here: the migration runner wraps the file in a transaction.
--
-- Rollback: lift every active withdrawal first (retrait_lever), then
--   drop function public.retrait_lever(uuid, text, text);
--   drop function public.retrait_poser(uuid, uuid, text, text, text, text, uuid, date, text);
--   drop view public.import_retraits_actifs;
--   drop table public.import_retraits_vitrines, public.import_retraits_fiches, public.import_retraits;
--   drop function public.texte_normalise(text);   -- only if 0030 did not take it over
-- and recreate evenements_public_read without the show_on_public_site test.

-- =====================================================================
-- A. Text normalisation helper (also needed by P1, 0030, same signature:
--    create or replace keeps both migrations compatible).
--    Lower case, accents folded, every non alphanumeric run becomes one space.
--    No dependency on the unaccent extension.
-- =====================================================================
create or replace function public.texte_normalise(t text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select btrim(regexp_replace(
    translate(
      replace(replace(lower(coalesce(t, '')), U&'\0153', 'oe'), U&'\00E6', 'ae'),
      U&'\00E0\00E2\00E4\00E1\00E3\00E5\00E7\00E9\00E8\00EA\00EB\00ED\00EC\00EE\00EF\00F1\00F3\00F2\00F4\00F6\00F5\00FA\00F9\00FB\00FC\00FD\00FF',
      'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

revoke all on function public.texte_normalise(text) from public, anon, authenticated;
grant execute on function public.texte_normalise(text) to service_role;

-- =====================================================================
-- B. Journal and current state.
-- =====================================================================
create table if not exists public.import_retraits (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid references public.organizations(id) on delete set null,
  annuaire_lieu_id   uuid references public.annuaire_lieux(id) on delete set null,
  portee             text not null check (portee in ('medias', 'fiches', 'import')),
  -- null: all sources; otherwise 'openagenda', 'datatourisme', 'site:<domain>'
  -- (same spelling as evenements_import.source)
  source             text,
  -- fingerprints, to recognise the same structure imported under another source
  nom_normalise      text,
  commune_normalisee text,
  domaine_web        text,
  motif              text not null check (length(btrim(motif)) between 3 and 500),
  demande_canal      text not null check (demande_canal in ('courriel', 'telephone', 'formulaire', 'equipe', 'plainte')),
  demande_thread_id  uuid references public.outreach_threads(id) on delete set null,
  demande_le         date not null default current_date,
  pose_le            timestamptz not null default now(),
  pose_par           text not null,
  leve_le            timestamptz,
  leve_par           text,
  leve_motif         text,
  constraint import_retraits_cible check (organization_id is not null or annuaire_lieu_id is not null),
  constraint import_retraits_source_portee check (source is null or portee = 'import'),
  constraint import_retraits_levee check ((leve_le is null) = (leve_par is null))
);

create index if not exists import_retraits_org_idx
  on public.import_retraits (organization_id) where leve_le is null;
create index if not exists import_retraits_annuaire_idx
  on public.import_retraits (annuaire_lieu_id) where leve_le is null;
-- one active withdrawal per target, scope and source
create unique index if not exists import_retraits_actif_uniq
  on public.import_retraits (coalesce(organization_id, annuaire_lieu_id), portee, coalesce(source, '*'))
  where leve_le is null;

-- State of each event before the withdrawal changed it.
create table if not exists public.import_retraits_fiches (
  retrait_id        uuid not null references public.import_retraits(id) on delete restrict,
  event_id          uuid not null references public.evenements(id) on delete cascade,
  show_avant        boolean not null,
  description_avant text,
  photos_avant      text[] not null default '{}',
  checked_at_avant  timestamptz,
  restaure_le       timestamptz,
  primary key (retrait_id, event_id)
);

-- State of the technical showcase (public_sites) before it was retired.
create table if not exists public.import_retraits_vitrines (
  retrait_id      uuid not null references public.import_retraits(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status_avant    text not null,
  restaure_le     timestamptz,
  primary key (retrait_id, organization_id)
);

comment on table public.import_retraits is
  'Journal des retraits sur demande (R3, R12). Une ligne sans leve_le est un retrait actif, applique aux fiches presentes et aux imports futurs. Ne contient ni courriel ni nom du demandeur.';
comment on table public.import_retraits_fiches is
  'Photographie par fiche de l''etat avant retrait (visibilite, description, photos, checked_at). Sert a la levee.';
comment on table public.import_retraits_vitrines is
  'Photographie du statut de la vitrine technique public_sites avant retrait. Sert a la levee.';

-- =====================================================================
-- C. What the import scripts read.
-- =====================================================================
create or replace view public.import_retraits_actifs
with (security_invoker = true) as
  select id, organization_id, annuaire_lieu_id, portee, source,
         nom_normalise, commune_normalisee, domaine_web
    from public.import_retraits
   where leve_le is null;

-- =====================================================================
-- D. Rights: nothing for the public site or a signed-in account (the reason
--    and the channel of a request are not public). The journal is never
--    rewritten: no DELETE and no TRUNCATE, even for the service role.
-- =====================================================================
alter table public.import_retraits          enable row level security;
alter table public.import_retraits_fiches   enable row level security;
alter table public.import_retraits_vitrines enable row level security;

revoke all on public.import_retraits, public.import_retraits_fiches,
              public.import_retraits_vitrines, public.import_retraits_actifs
  from public, anon, authenticated, service_role;
grant select, insert, update on public.import_retraits, public.import_retraits_fiches,
                                public.import_retraits_vitrines to service_role;
grant select on public.import_retraits_actifs to service_role;

-- =====================================================================
-- E. Functions. security definer, so they run as the owner and bypass RLS;
--    only service_role may execute them (the admin server actions call them
--    after requireSuperAdmin()). One transaction each, by construction.
--
--    Error messages start with a stable code (retrait_*) that the admin
--    action maps to a readable sentence.
-- =====================================================================

create or replace function public.retrait_poser(
  p_organization_id uuid,
  p_annuaire_lieu_id uuid,
  p_portee text,
  p_source text,
  p_motif text,
  p_canal text,
  p_thread uuid,
  p_demande_le date,
  p_par text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       uuid := gen_random_uuid();
  v_now      timestamptz := now();
  v_org      uuid := p_organization_id;
  v_ann      uuid := p_annuaire_lieu_id;
  v_found    boolean;
  v_o_name   text;
  v_o_site   text;
  v_o_claim  timestamptz;
  v_o_source text;
  v_a_nom    text;
  v_a_comm   text;
  v_a_site   text;
  v_a_org    uuid;
  v_nom      text;
  v_commune  text;
  v_site     text;
  v_domaine  text;
  v_fiches   int := 0;
  v_vitrines int := 0;
  v_annuaire int := 0;
begin
  if p_portee is null or p_portee not in ('medias', 'fiches', 'import') then
    raise exception 'retrait_portee_invalide: la portee doit etre medias, fiches ou import';
  end if;
  if p_source is not null and p_portee <> 'import' then
    raise exception 'retrait_source_invalide: une source ne se precise que pour la portee import';
  end if;
  if p_par is null or btrim(p_par) = '' then
    raise exception 'retrait_auteur_manquant: l''auteur du retrait est obligatoire';
  end if;
  if v_org is null and v_ann is null then
    raise exception 'retrait_cible_manquante: il faut une organisation ou un lieu de l''annuaire';
  end if;

  -- 2. Resolve the target.
  if v_ann is not null then
    select true, l.nom, l.commune, l.site_web, l.organization_id
      into v_found, v_a_nom, v_a_comm, v_a_site, v_a_org
      from public.annuaire_lieux l where l.id = v_ann;
    if not coalesce(v_found, false) then
      raise exception 'retrait_lieu_introuvable: lieu de l''annuaire inconnu';
    end if;
    if v_org is null then
      v_org := v_a_org;                 -- may stay null: place never imported
    end if;
  end if;

  if v_org is not null then
    select true, o.name, o.website, o.claimed_at, o.source
      into v_found, v_o_name, v_o_site, v_o_claim, v_o_source
      from public.organizations o where o.id = v_org;
    if not coalesce(v_found, false) then
      raise exception 'retrait_organisation_introuvable: organisation inconnue';
    end if;
    -- 1. Claimed, member-run or admin-born organizations manage their own events.
    if v_o_claim is not null
       or v_o_source = 'casaminga'
       or exists (select 1 from public.organization_members m where m.organization_id = v_org) then
      raise exception 'retrait_organisation_revendiquee: cette organisation gere ses fiches depuis son espace';
    end if;
    -- Single directory row for the organization: remember it on the journal row.
    if v_ann is null and (select count(*) from public.annuaire_lieux where organization_id = v_org) = 1 then
      select l.id, l.nom, l.commune, l.site_web
        into v_ann, v_a_nom, v_a_comm, v_a_site
        from public.annuaire_lieux l where l.organization_id = v_org;
    end if;
  end if;

  -- Fingerprints: only for a withdrawal that must also block the same structure
  -- arriving later under another source.
  if p_portee = 'import' and p_source is null then
    v_nom := nullif(public.texte_normalise(coalesce(v_o_name, v_a_nom)), '');
    v_commune := nullif(public.texte_normalise(coalesce(
      (select e.city from public.establishments e
        where e.organization_id = v_org
        order by e.is_primary desc nulls last, e.position nulls last, e.created_at
        limit 1),
      v_a_comm)), '');
    v_site := coalesce(nullif(btrim(v_o_site), ''), nullif(btrim(v_a_site), ''));
    v_domaine := substring(lower(btrim(v_site))
                           from '^(?:[a-z][a-z0-9+.-]*://)?(?:www\.)?([^/:?#[:space:]]+)');
  end if;

  -- 3. Journal row. The partial unique index refuses an active duplicate.
  begin
    insert into public.import_retraits (
      id, organization_id, annuaire_lieu_id, portee, source,
      nom_normalise, commune_normalisee, domaine_web,
      motif, demande_canal, demande_thread_id, demande_le,
      pose_le, pose_par)
    values (
      v_id, v_org, v_ann, p_portee, p_source,
      v_nom, v_commune, v_domaine,
      p_motif, p_canal, p_thread, coalesce(p_demande_le, current_date),
      v_now, btrim(p_par));
  exception when unique_violation then
    raise exception 'retrait_deja_actif: un retrait identique est deja actif pour cette cible';
  end;

  if v_org is not null then
    -- 4. Photograph the targeted events (all dates, past ones included).
    insert into public.import_retraits_fiches
      (retrait_id, event_id, show_avant, description_avant, photos_avant, checked_at_avant)
    select v_id, e.id, e.show_on_public_site, e.description,
           coalesce(e.photos, '{}'), i.checked_at
      from public.evenements e
      left join public.evenements_import i on i.event_id = e.id
     where e.organization_id = v_org
       and (p_source is null or i.source = p_source)
     order by e.id
       for update of e;
    get diagnostics v_fiches = row_count;

    -- 5. Apply. Every scope removes the media; fiches and import also hide.
    update public.evenements e
       set description = null,
           photos = '{}',
           show_on_public_site = case when p_portee in ('fiches', 'import')
                                      then false else e.show_on_public_site end
      from public.import_retraits_fiches f
     where f.retrait_id = v_id and f.event_id = e.id;

    -- 6. R8: mark the events as checked so no later run rewrites them.
    update public.evenements_import
       set checked_at = v_now
     where checked_at is null
       and event_id in (select event_id from public.import_retraits_fiches where retrait_id = v_id);

    -- Technical showcase: only when the withdrawal covers every source.
    if p_portee in ('fiches', 'import') and p_source is null then
      insert into public.import_retraits_vitrines (retrait_id, organization_id, status_avant)
      select v_id, s.organization_id, s.status
        from public.public_sites s
       where s.organization_id = v_org and s.status = 'publie';
      get diagnostics v_vitrines = row_count;

      update public.public_sites s
         set status = 'retire'
       where s.organization_id = v_org and s.status = 'publie';
    end if;
  end if;

  -- Directory: hide the place so that the probes stop reading it.
  if p_portee = 'import' and p_source is null then
    update public.annuaire_lieux l
       set masque = true,
           motif_masquage = 'retrait ' || v_id::text
     where not l.masque
       and ((v_org is not null and l.organization_id = v_org)
            or (v_ann is not null and l.id = v_ann));
    get diagnostics v_annuaire = row_count;
  end if;

  return jsonb_build_object(
    'retrait_id', v_id,
    'fiches', v_fiches,
    'vitrines', v_vitrines,
    'annuaire', v_annuaire);
end;
$$;

create or replace function public.retrait_lever(
  p_retrait_id uuid,
  p_motif text,
  p_par text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r          public.import_retraits%rowtype;
  f          record;
  v          record;
  l          record;
  ev_show    boolean;
  ev_desc    text;
  ev_photos  text[];
  v_chk      timestamptz;
  v_has_imp  boolean;
  v_cov_show boolean;
  v_cov_med  boolean;
  v_chg      boolean;
  do_show    boolean;
  do_desc    boolean;
  do_photos  boolean;
  do_chk     boolean;
  v_left     boolean;
  v_covered  boolean;
  v_next     uuid;
  n_ok       int := 0;
  n_left     int := 0;
  n_cov      int := 0;
  n_vit      int := 0;
  n_ann      int := 0;
begin
  if p_par is null or btrim(p_par) = '' then
    raise exception 'retrait_auteur_manquant: l''auteur de la levee est obligatoire';
  end if;

  -- 1. Refuse an unknown or already lifted withdrawal.
  select * into r from public.import_retraits where id = p_retrait_id for update;
  if not found then
    raise exception 'retrait_introuvable: retrait inconnu';
  end if;
  if r.leve_le is not null then
    raise exception 'retrait_deja_leve: ce retrait est deja leve';
  end if;

  -- 2. Events. A field is put back only if it still holds the value this
  --    withdrawal wrote: a human correction made meanwhile wins (R8).
  --    When another active withdrawal also covers the event, the live value is
  --    left alone and the photograph of that other withdrawal takes over our
  --    "before" value, so that lifting in any order never loses the original.
  for f in
    select * from public.import_retraits_fiches
     where retrait_id = r.id and restaure_le is null
     order by event_id
  loop
    select e.show_on_public_site, e.description, coalesce(e.photos, '{}')
      into ev_show, ev_desc, ev_photos
      from public.evenements e where e.id = f.event_id
       for update;
    select i.checked_at, true into v_chk, v_has_imp
      from public.evenements_import i where i.event_id = f.event_id;
    v_has_imp := coalesce(v_has_imp, false);

    -- Coverage by another active withdrawal that holds a photograph of this event.
    select exists (
      select 1 from public.import_retraits_fiches g
        join public.import_retraits o on o.id = g.retrait_id
       where g.event_id = f.event_id and g.retrait_id <> r.id
         and g.restaure_le is null and o.leve_le is null
         and o.portee in ('fiches', 'import')) into v_cov_show;
    select exists (
      select 1 from public.import_retraits_fiches g
        join public.import_retraits o on o.id = g.retrait_id
       where g.event_id = f.event_id and g.retrait_id <> r.id
         and g.restaure_le is null and o.leve_le is null) into v_cov_med;

    v_left := false;
    v_covered := false;
    do_show := false; do_desc := false; do_photos := false; do_chk := false;

    -- show_on_public_site: written by fiches and import, only if it was visible.
    v_chg := r.portee in ('fiches', 'import') and f.show_avant;
    if v_chg then
      if not ev_show then
        if v_cov_show then
          update public.import_retraits_fiches g
             set show_avant = f.show_avant
            from public.import_retraits o
           where o.id = g.retrait_id and g.event_id = f.event_id and g.retrait_id <> r.id
             and g.restaure_le is null and o.leve_le is null
             and o.portee in ('fiches', 'import') and not g.show_avant;
          v_covered := true;
        else
          do_show := true;
        end if;
      else
        v_left := true;       -- someone made it visible again meanwhile
      end if;
    end if;

    -- description
    v_chg := f.description_avant is not null;
    if v_chg then
      if ev_desc is null then
        if v_cov_med then
          update public.import_retraits_fiches g
             set description_avant = f.description_avant
            from public.import_retraits o
           where o.id = g.retrait_id and g.event_id = f.event_id and g.retrait_id <> r.id
             and g.restaure_le is null and o.leve_le is null
             and g.description_avant is null;
          v_covered := true;
        else
          do_desc := true;
        end if;
      else
        v_left := true;       -- a description was typed meanwhile
      end if;
    end if;

    -- photos
    v_chg := coalesce(array_length(f.photos_avant, 1), 0) > 0;
    if v_chg then
      if coalesce(array_length(ev_photos, 1), 0) = 0 then
        if v_cov_med then
          update public.import_retraits_fiches g
             set photos_avant = f.photos_avant
            from public.import_retraits o
           where o.id = g.retrait_id and g.event_id = f.event_id and g.retrait_id <> r.id
             and g.restaure_le is null and o.leve_le is null
             and coalesce(array_length(g.photos_avant, 1), 0) = 0;
          v_covered := true;
        else
          do_photos := true;
        end if;
      else
        v_left := true;       -- photos were added meanwhile
      end if;
    end if;

    -- checked_at (provenance row): written as pose_le when it was null.
    v_chg := v_has_imp and f.checked_at_avant is null;
    if v_chg then
      if v_chk = r.pose_le then
        if v_cov_med then
          -- The other withdrawal photographed our pose_le as its "before" value:
          -- give it the original (null) and hand it a value it recognises.
          update public.import_retraits_fiches g
             set checked_at_avant = f.checked_at_avant
            from public.import_retraits o
           where o.id = g.retrait_id and g.event_id = f.event_id and g.retrait_id <> r.id
             and g.restaure_le is null and o.leve_le is null
             and g.checked_at_avant = r.pose_le;
          update public.evenements_import i
             set checked_at = (select min(o.pose_le)
                                 from public.import_retraits_fiches g
                                 join public.import_retraits o on o.id = g.retrait_id
                                where g.event_id = f.event_id and g.retrait_id <> r.id
                                  and g.restaure_le is null and o.leve_le is null)
           where i.event_id = f.event_id;
          v_covered := true;
        else
          do_chk := true;
        end if;
      elsif v_chk is distinct from f.checked_at_avant then
        v_left := true;       -- checked by a human meanwhile
      end if;
    end if;

    if do_show or do_desc or do_photos then
      update public.evenements e
         set show_on_public_site = case when do_show then f.show_avant else e.show_on_public_site end,
             description = case when do_desc then f.description_avant else e.description end,
             photos = case when do_photos then f.photos_avant else e.photos end
       where e.id = f.event_id;
    end if;
    if do_chk then
      update public.evenements_import
         set checked_at = f.checked_at_avant
       where event_id = f.event_id and checked_at = r.pose_le;
    end if;

    update public.import_retraits_fiches
       set restaure_le = now()
     where retrait_id = r.id and event_id = f.event_id;

    if v_left then n_left := n_left + 1; else n_ok := n_ok + 1; end if;
    if v_covered then n_cov := n_cov + 1; end if;
  end loop;

  -- 4. Technical showcases: put the status back if it is still 'retire'.
  --    If another active withdrawal for the same organization also retires it,
  --    that one inherits the photograph instead.
  for v in
    select * from public.import_retraits_vitrines
     where retrait_id = r.id and restaure_le is null
  loop
    select o.id into v_next
      from public.import_retraits o
     where o.id <> r.id and o.leve_le is null
       and o.organization_id = v.organization_id
       and o.portee in ('fiches', 'import') and o.source is null
     order by o.pose_le
     limit 1;
    if v_next is not null then
      insert into public.import_retraits_vitrines (retrait_id, organization_id, status_avant)
      values (v_next, v.organization_id, v.status_avant)
      on conflict (retrait_id, organization_id) do nothing;
    else
      update public.public_sites s
         set status = v.status_avant
       where s.organization_id = v.organization_id and s.status = 'retire';
      if found then n_vit := n_vit + 1; end if;
    end if;
    update public.import_retraits_vitrines
       set restaure_le = now()
     where retrait_id = r.id and organization_id = v.organization_id;
  end loop;

  -- 5. Directory rows hidden by this withdrawal (and only those).
  for l in
    select * from public.annuaire_lieux
     where masque and motif_masquage = 'retrait ' || r.id::text
  loop
    v_next := null;
    select o.id into v_next
      from public.import_retraits o
     where o.id <> r.id and o.leve_le is null
       and o.portee = 'import' and o.source is null
       and ((o.organization_id is not null and o.organization_id = l.organization_id)
            or (o.annuaire_lieu_id is not null and o.annuaire_lieu_id = l.id))
     order by o.pose_le
     limit 1;
    if v_next is not null then
      update public.annuaire_lieux
         set motif_masquage = 'retrait ' || v_next::text
       where id = l.id;
    else
      update public.annuaire_lieux
         set masque = false, motif_masquage = null
       where id = l.id;
      n_ann := n_ann + 1;
    end if;
  end loop;

  -- 6. Close the journal row.
  update public.import_retraits
     set leve_le = now(),
         leve_par = btrim(p_par),
         leve_motif = nullif(btrim(coalesce(p_motif, '')), '')
   where id = r.id;

  return jsonb_build_object(
    'retrait_id', r.id,
    'fiches_restaurees', n_ok,
    'fiches_laissees', n_left,
    'fiches_couvertes_par_un_autre_retrait', n_cov,
    'vitrines', n_vit,
    'annuaire', n_ann);
end;
$$;

revoke all on function public.retrait_poser(uuid, uuid, text, text, text, text, uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.retrait_poser(uuid, uuid, text, text, text, text, uuid, date, text)
  to service_role;
revoke all on function public.retrait_lever(uuid, text, text) from public, anon, authenticated;
grant execute on function public.retrait_lever(uuid, text, text) to service_role;

-- =====================================================================
-- F. Public read policy on evenements (BEHAVIOUR CHANGE, to validate on its
--    own before applying: the 77 events already hidden, France Travail
--    included, stop being readable by the anon key and by their address).
--    Members and signed-in accounts keep evenements_member_all / evenements_read.
-- =====================================================================
drop policy if exists evenements_public_read on public.evenements;
create policy evenements_public_read on public.evenements
  for select
  using (status = any (array['publie', 'confirme', 'planifie']) and show_on_public_site);
