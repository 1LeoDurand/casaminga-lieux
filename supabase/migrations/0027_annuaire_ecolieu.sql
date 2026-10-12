-- ANNUAIRE : ECOLIEUX (T34, decision D7 du 2026-10-12)
--
-- Prepare l'arrivee des ecolieux (base Oasis, Transiscope) dans annuaire_lieux.
-- NON APPLIQUEE a la redaction. A appliquer avant `import-ecolieux.py --ecrire`.
--
-- Verifie le 2026-10-12 sur la base distante :
--   * aucune contrainte CHECK sur `type` (seules : pkey, unique (source,
--     id_source), cle etrangere organization_id) : le type `ecolieu` passe sans
--     migration ;
--   * `licence` existe deja (text not null) : elle porte la licence par ligne ;
--   * `attribution` n'existe pas : c'est la seule colonne ajoutee ici.

alter table public.annuaire_lieux
  add column if not exists attribution text;

comment on column public.annuaire_lieux.attribution is
  'Mention de source a afficher avec la licence de la ligne (CC BY-SA et ODbL exigent la citation). Vide pour le recensement France Tiers-Lieux, dont la source est deja dans `source`.';
