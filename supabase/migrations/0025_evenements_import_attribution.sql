-- 0025_evenements_import_attribution
--
-- Attribution required by the Licence Ouverte 2.0 for DATAtourisme imports
-- (scripts/import-datatourisme.py, decided by Leo on 2026-10-08): every reuse
-- must name the producer of the record (hasBeenCreatedBy, CSV column
-- Createur_de_la_donnee) and the date of its last update. Generic enough for
-- any other source that carries the same obligation.
--
-- Additive and nullable: no existing row changes. Read access follows the
-- table grant and the existing policy evenements_import_public_read, which is
-- what we want: the public site must display the mention.

alter table public.evenements_import
  add column if not exists attribution text,
  add column if not exists source_maj date;

comment on column public.evenements_import.attribution is
  'Producteur de la donnee a citer (Licence Ouverte), ex. « ADT34 via DATAtourisme ». Null quand la source n''impose rien.';
comment on column public.evenements_import.source_maj is
  'Date de derniere mise a jour de la fiche a la source, a citer avec l''attribution.';
