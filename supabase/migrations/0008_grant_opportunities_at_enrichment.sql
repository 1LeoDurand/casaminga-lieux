-- Enrichissement Aides-Territoires (Layer 2 du module veille subventions).
-- Ajoute les colonnes nécessaires au tri géographique précis (code région INSEE)
-- et au filtrage par nature d'aide / gratuité. Sans ces colonnes, le tri
-- fonctionne déjà via les libellés (Layer 1) ; elles ne font qu'affiner.
--
-- ⚠️ Ordre de déploiement : appliquer cette migration AVANT de déployer un import
-- enrichi (activé par AIDES_TERRITOIRES_ENRICH=1), puis relancer l'import pour
-- peupler les colonnes sur le catalogue existant.
alter table grant_opportunities
  add column if not exists aid_type_slugs text[] not null default '{}',
  add column if not exists is_charged boolean,
  add column if not exists region_code text,
  add column if not exists perimeter_scale text;

-- Filtrage géo par région et par nature d'aide.
create index if not exists grant_opportunities_region_code_idx
  on grant_opportunities (region_code);
create index if not exists grant_opportunities_aid_type_slugs_idx
  on grant_opportunities using gin (aid_type_slugs);
