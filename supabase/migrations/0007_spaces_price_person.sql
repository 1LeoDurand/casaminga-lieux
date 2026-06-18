-- Tarif par personne sur les espaces.
-- Utile pour les hébergements (dortoirs, chambres) facturés à la nuitée
-- par personne, en plus des tarifs horaire et journalier existants.

alter table public.spaces
  add column if not exists price_person numeric;

comment on column public.spaces.price_person is
  'Tarif par personne (€), ex. pour dortoirs/chambres facturés à la nuitée par personne.';
