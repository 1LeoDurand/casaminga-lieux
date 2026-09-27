-- ════════════════════════════════════════════════════════════
-- ANNUAIRE NATIONAL DES TIERS-LIEUX
-- ════════════════════════════════════════════════════════════
-- Jusqu'ici, /lieux sur casaminga.com ne montrait que les organisations
-- présentes dans l'admin : une trentaine de fiches, dont la plupart moissonnées
-- pour leur agenda. Un annuaire de trente lieux n'est pas un annuaire, et un
-- visiteur qui cherche un tiers-lieu près de chez lui repart les mains vides.
--
-- Cette table accueille le recensement national des tiers-lieux publié par
-- France Tiers-Lieux sur data.gouv.fr, en Licence Ouverte 2.0 : republiable, à
-- condition de citer la source. 3 951 lieux, tous géolocalisés.
--
-- Trois principes tiennent cette table :
--
--   1. ELLE EST À PART. Elle ne touche ni `organizations` ni `establishments`.
--      Un lieu recensé n'est pas une organisation de Casa Minga : il n'a rien
--      demandé, il n'a pas d'espace, il n'a pas d'adhérents. Les mélanger
--      obligerait chaque lecture de l'admin à distinguer les vraies fiches des
--      lignes d'annuaire, et la première requête oubliée afficherait 3 951
--      organisations fantômes dans un tableau de bord.
--
--   2. ELLE NE CONTIENT AUCUNE COORDONNÉE DE CONTACT. Le recensement publie des
--      adresses de courriel et des numéros de téléphone. Les reverser sur un
--      site public, c'est les offrir aux moissonneurs de spam au nom de lieux
--      qui ne nous ont rien demandé. Seul `site_web` est ici, parce qu'une
--      adresse de site est faite pour être publiée. Les coordonnées restent
--      dans les fichiers de collecte, hors base.
--
--   3. ELLE EST UNE SOURCE, PAS UNE VÉRITÉ. Chaque ligne porte sa source, son
--      adresse de jeu de données et sa licence. L'affichage public doit dire
--      d'où vient la donnée et ne jamais laisser croire que le lieu est membre.

create table if not exists public.annuaire_lieux (
  id                uuid primary key,

  -- Identifiant du lieu DANS le jeu de données d'origine. Avec `source`, il
  -- forme la clé de réimport : un nouveau millésime du recensement met à jour
  -- les lignes existantes au lieu d'en créer des doubles. `id` lui-même est
  -- dérivé du couple (uuid5), donc stable entre deux imports.
  id_source         text,
  source            text not null,
  source_url        text,
  licence           text not null default 'Licence Ouverte 2.0',

  nom               text not null,

  -- Le recensement distingue le type (tiers_lieu, fablab, friche_culturelle,
  -- cafe_associatif, recyclerie…) des « familles », qui ne sont renseignées
  -- que pour un lieu sur quatre. Aucune contrainte de valeurs : un millésime
  -- suivant ajouterait sinon une migration.
  type              text,
  familles          text,

  -- « Lieu ouvert », « Lieu itinérant », « On ne sait pas ». Le troisième cas
  -- pèse 1 423 lignes : il faut pouvoir le dire à l'écran plutôt que de
  -- présenter comme ouvert un lieu dont on ignore l'état.
  etat              text,
  statut_juridique  text,

  adresse           text,
  commune           text,
  code_postal       text,
  code_insee        text,
  departement       text,
  region            text,
  latitude          double precision,
  longitude         double precision,

  site_web          text,

  -- Rattachement à une organisation de l'admin, quand le lieu recensé EST un
  -- lieu du réseau. Renseigné, il évite de montrer deux fois le même endroit :
  -- la fiche du réseau prime, la ligne d'annuaire s'efface.
  organization_id   uuid references public.organizations(id) on delete set null,

  -- Retrait éditorial : un lieu fermé, un doublon que l'appariement n'a pas vu,
  -- une demande du lieu lui-même. Préférable à une suppression, que le prochain
  -- import rétablirait aussitôt.
  masque            boolean not null default false,
  motif_masquage    text,

  imported_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (source, id_source)
);

comment on table public.annuaire_lieux is
  'Annuaire des tiers-lieux issus de recensements ouverts. Aucun de ces lieux n''est membre de Casa Minga : voir organizations pour cela.';
comment on column public.annuaire_lieux.masque is
  'Retrait éditorial. La ligne reste en base (le prochain import la rétablirait) mais ne sort plus en lecture publique.';
comment on column public.annuaire_lieux.organization_id is
  'Renseigné quand ce lieu recensé correspond à une organisation de l''admin. La fiche du réseau prime alors sur la ligne d''annuaire.';

create index if not exists annuaire_lieux_region_idx on public.annuaire_lieux (region);
create index if not exists annuaire_lieux_commune_idx on public.annuaire_lieux (commune);
create index if not exists annuaire_lieux_geo_idx on public.annuaire_lieux (latitude, longitude)
  where latitude is not null and longitude is not null;

-- ── Lecture publique, écriture réservée ──────────────────────
-- Le portail lit avec la clé anon : il lui faut une politique de lecture. Elle
-- exclut les lignes masquées, ce qui fait du masquage un geste efficace en une
-- écriture, sans redéploiement.
--
-- Aucune politique d'écriture : ni `anon` ni `authenticated` ne peuvent écrire
-- ici. L'import passe par la clé de service, l'admin aussi. C'est voulu : cette
-- table reflète une source extérieure, personne ne la remplit à la main.
alter table public.annuaire_lieux enable row level security;

drop policy if exists "annuaire_select_visible" on public.annuaire_lieux;
create policy "annuaire_select_visible" on public.annuaire_lieux
  for select using (masque = false);
