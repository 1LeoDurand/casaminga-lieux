-- 0022_evenements_import_photos_retirees
--
-- Trace of posters removed from evenements.photos because their host refuses
-- to serve them outside its own site (403 hotlink protection), has deleted
-- them (404) or serves them without an image content type. Written by
-- scripts/verifier-affiches.py --ecrire, decided by Leo on 2026-09-30.
--
-- Rollback for one event:
--   update evenements e set photos = e.photos || i.photos_retirees
--     from evenements_import i where i.event_id = e.id and i.event_id = '<id>';
--   update evenements_import set photos_retirees = '{}' where event_id = '<id>';
--
-- Additive: no existing value changes. Read access follows the table grant
-- (the public site reads evenements_import for provenance).

alter table public.evenements_import
  add column if not exists photos_retirees text[] not null default '{}';

comment on column public.evenements_import.photos_retirees is
  'Affiches retirees de evenements.photos car leur hote refuse l''affichage hors de son site, les a supprimees ou les sert sans type image. Retour arriere : photos = photos || photos_retirees.';
