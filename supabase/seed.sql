-- ════════════════════════════════════════════════════════════
-- Casa Minga Lieux — Seed démonstrateur : Tiers-lieu Bernard Kohn
-- À exécuter après la migration 0001_init_socle.sql.
-- ════════════════════════════════════════════════════════════

-- Organisation démonstrateur (uuid fixe pour des liens stables)
insert into public.organizations
  (id, slug, name, structure, address, email, phone, website, description, hours, plan, primary_color)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'bernard-kohn',
   'Tiers-lieu Bernard Kohn',
   'Association loi 1901',
   'Saint-Mandé (94)',
   'contact@bernard-kohn.org',
   '+33 1 00 00 00 00',
   'https://casaminga.com/bernard-kohn',
   'Ancienne maison et atelier de l''architecte Bernard Kohn, devenue tiers-lieu : ateliers, résidences, espaces partagés et programmation culturelle au service du collectif.',
   'Du mardi au samedi, 9h–19h',
   'essentiel',
   '#FF8A65')
on conflict (id) do nothing;

-- Site public publié
insert into public.public_sites
  (organization_id, slug, title, status, seo_description, published_at, content_blocks)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'bernard-kohn',
   'Tiers-lieu Bernard Kohn',
   'publie',
   'Tiers-lieu à Saint-Mandé : ateliers, résidences artistiques, espaces partagés et événements ouverts au public.',
   now(),
   '[]'::jsonb)
on conflict (organization_id, slug) do nothing;

-- Quelques demandes entrantes de démonstration
insert into public.requests
  (organization_id, name, email, type, status, priority, summary, message)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Camille Aubry', 'camille.aubry@example.org',
   'residence', 'nouvelle', 'haute',
   'Demande de résidence artistique (céramique) — 3 semaines',
   'Bonjour, je suis céramiste et je souhaiterais candidater pour une résidence cet automne.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Studio Halle Nord', 'contact@hallenord.fr',
   'salle', 'etudier', 'normale',
   'Réservation de la grande salle pour une exposition (week-end)',
   'Nous cherchons un espace pour une exposition collective sur deux jours.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Mairie de Saint-Mandé', 'culture@saintmande.fr',
   'partenariat', 'attente', 'haute',
   'Proposition de partenariat sur la programmation jeunesse',
   'Nous aimerions échanger sur un partenariat autour des ateliers jeunesse.')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- Pour devenir membre admin du lieu démo :
-- 1) crée ton compte via l'app (login),
-- 2) récupère ton user id, puis exécute :
--
-- insert into public.organization_members (organization_id, user_id, role, status)
-- values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '<TON_USER_ID>', 'admin', 'active')
-- on conflict do nothing;
-- ────────────────────────────────────────────────────────────
