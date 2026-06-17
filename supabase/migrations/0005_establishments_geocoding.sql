-- Géocodage des établissements : coordonnées + code postal capturés via
-- l'autocomplétion d'adresse (Base Adresse Nationale) dans le formulaire admin.
-- Permet à la carte publique (casaminga.com) de positionner les lieux de façon fiable.
alter table establishments
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists postal_code text;
