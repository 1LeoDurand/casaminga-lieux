-- Visibilité des noms entre coéquipiers.
-- Avant : la policy de lecture de `profiles` n'autorisait que son propre profil
-- (id = auth.uid()), donc dans la page Équipe tous les autres membres
-- apparaissaient « Sans nom ». Symétrique pour chaque utilisateur.
--
-- Correctif : on autorise la lecture du profil de toute personne qui partage
-- une organisation active avec l'utilisateur courant. La vérification passe par
-- une fonction SECURITY DEFINER pour éviter la récursion RLS et rester perfo.

create or replace function public.shares_org_with(target uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1
    from organization_members me
    join organization_members them
      on them.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and them.user_id = target
      and me.status = 'actif' and them.status = 'actif'
  );
$$;

drop policy if exists profiles_select_comember on public.profiles;
create policy profiles_select_comember on public.profiles
  for select using ( shares_org_with(id) );
