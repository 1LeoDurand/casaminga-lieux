-- ════════════════════════════════════════════════════════════
-- 0014 : les besoins publiés par les lieux (page /contribuer du portail)
-- ════════════════════════════════════════════════════════════
--
-- Ce que c'est : un appel lancé par une organisation à qui veut l'aider.
-- Un coup de main ponctuel, une compétence cherchée, un chantier à venir,
-- du matériel, un financement. Le portail les rassemble sur /contribuer.
--
-- Trois partis pris, à relire avant toute modification.
--
-- 1. TABLE À PART, pas une colonne de plus sur `evenements`. Un besoin n'est
--    pas un rendez-vous : il n'a ni horaire ni billetterie, il vit tant qu'il
--    n'est pas pourvu, et il se répond par un contact, pas par une entrée.
--    Les loger ensemble aurait fait entrer les besoins dans l'agenda public,
--    où personne ne les cherche.
--
-- 2. AUCUNE COORDONNÉE PERSONNELLE. `contact_url` est une adresse web, pas un
--    courriel ni un téléphone : la page est publique et lue par des robots.
--    Un lieu qui veut être joint par courriel passe par sa vitrine, qui porte
--    déjà son formulaire.
--
-- 3. LECTURE PUBLIQUE SEULEMENT SI LA VITRINE EST PUBLIÉE. Sans cela, le
--    portail afficherait un appel sans pouvoir nommer ni relier qui le lance :
--    `organizations` n'est lisible en anonyme que pour les sites publiés. Un
--    appel anonyme n'est pas un appel, c'est une impasse.
--
-- Migration additive : aucune table existante n'est modifiée.

create table if not exists public.besoins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Le lieu concerné, quand l'organisation en compte plusieurs. Nul vaut
  -- « toute l'organisation », pas « lieu inconnu ».
  establishment_id uuid references public.establishments(id) on delete set null,

  titre text not null,
  resume text,

  -- Ce qui est cherché. Le portail en fait des familles affichables ; une
  -- valeur inconnue retombe sur « coup de main », jamais sur une invention.
  nature text not null default 'benevolat'
    check (nature in ('benevolat', 'competence', 'chantier', 'materiel', 'financement')),

  -- Un besoin réalisable sans se déplacer : traduction, relecture, un visuel.
  a_distance boolean not null default false,

  -- Ce que ça demande, en clair : « deux heures par semaine », « une journée ».
  -- Texte libre parce que la réalité l'est : aucune durée n'est calculée.
  engagement text,

  debut_at timestamptz,
  fin_at timestamptz,

  -- Nombre de personnes cherchées. Nul veut dire « non précisé » et ne
  -- s'affiche pas ; il ne vaut pas zéro.
  places integer check (places is null or places > 0),

  -- Où répondre. Une adresse web publique : vitrine du lieu, formulaire,
  -- page de collecte.
  contact_url text,

  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'publie', 'pourvu', 'archive')),
  publie_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_besoins_org on public.besoins(organization_id);
-- L'index du portail : il ne lit que les besoins publiés, du plus récent au
-- plus ancien.
create index if not exists idx_besoins_publies on public.besoins(statut, publie_at desc)
  where statut = 'publie';

alter table public.besoins enable row level security;

-- Lecture anonyme : un besoin publié par une organisation dont la vitrine
-- l'est aussi. Voir le parti pris 3 en tête de fichier.
drop policy if exists "besoins_select_public" on public.besoins;
create policy "besoins_select_public" on public.besoins
  for select using (
    statut = 'publie'
    and exists (
      select 1 from public.public_sites ps
      where ps.organization_id = besoins.organization_id and ps.status = 'publie'
    )
  );

-- Les membres de l'organisation voient et gèrent les leurs, brouillons compris.
drop policy if exists "besoins_member_all" on public.besoins;
create policy "besoins_member_all" on public.besoins
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
