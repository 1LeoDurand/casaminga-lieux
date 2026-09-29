-- outreach-demo-seed.sql
--
-- Fictional trial data to develop and check the /admin/contacts screens.
-- NOTHING here is real: 12 places on the reserved domain example.invalid,
-- two programs (articles-sejour, sav-sejour), threads at every stage,
-- inbound and outbound messages, a few fictional AI readings, one DEMO
-- context. Apply with the Supabase connector (execute_sql), on the
-- development database only, then run scripts/outreach-demo-clean.sql.
--
-- Every row uses a fixed id (prefix de..) and the tag 'demo', so the clean
-- script can find it. The script refuses to run if a contact already exists.
--
-- Side effects that the clean script reverts:
--   * articles-sejour gets an active DEMO context and is set active
--     (the database refuses to queue a message otherwise);
--   * the mailbox 'leo' is set active (same reason: outreach_guard_outbound).

do $seed$
declare
  p_art uuid := (select id from public.outreach_programs where slug = 'articles-sejour');
  p_sav uuid := (select id from public.outreach_programs where slug = 'sav-sejour');
  a1    uuid := 'de0a0000-0000-4000-8000-000000000001';
  a2    uuid := 'de0a0000-0000-4000-8000-000000000002';
begin
  if p_art is null or p_sav is null then
    raise exception 'seed: programs are missing, apply 0021_outreach first';
  end if;
  if exists (select 1 from public.outreach_contacts) then
    raise exception 'seed: contacts already exist, run outreach-demo-clean.sql first';
  end if;

  -- ---- DEMO context, then activation (the trigger checks readiness) --------
  insert into public.outreach_program_contexts (program_id, version, body, active, written_by, reviewed_by, reviewed_at, change_note)
  values (p_art, 1,
          'DEMO, à remplacer. ' || repeat('Contexte factice utilisé seulement pour développer les écrans du module contacts. Il ne décrit aucun vrai programme. ', 4),
          true, 'demo', 'demo', now(), 'DEMO, à remplacer');
  update public.outreach_mailboxes set active = true where key = 'leo';
  update public.outreach_programs set active = true where id = p_art;

  -- ---- Articles -----------------------------------------------------------
  insert into public.outreach_articles (id, source, slug, lang, title, url, published_at) values
    (a1, 'sejour', 'demo-vieillir-en-habitat-partage', 'fr', 'Vieillir en habitat partagé (DEMO)',
     'https://sejour.casaminga.com/ressources/demo-vieillir-en-habitat-partage', current_date - 20),
    (a2, 'sejour', 'demo-cuisiner-ensemble', 'fr', 'Cuisiner ensemble en habitat participatif (DEMO)',
     'https://sejour.casaminga.com/ressources/demo-cuisiner-ensemble', current_date - 8);

  -- ---- 12 fictional places and their addresses -------------------------------
  insert into public.outreach_contacts (id, name, kind, website, city, region, tags, notes)
  select ('de000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid, v.name, v.kind,
         'https://demo-lieu-' || v.n || '.example.invalid', v.city, v.region, array['demo'], 'DEMO, jeu d''essai fictif'
  from (values
    (1,  'Habitat DEMO Les Tilleuls',     'habitat_participatif', 'Rennes',        'Bretagne'),
    (2,  'Écolieu DEMO Le Pré Commun',    'ecolieu',              'Toulouse',      'Occitanie'),
    (3,  'Coopérative DEMO La Fabrique',  'tiers_lieu',           'Lyon',          'Auvergne-Rhône-Alpes'),
    (4,  'Habitat DEMO Les Trois Ponts',  'habitat_participatif', 'Strasbourg',    'Grand Est'),
    (5,  'Écolieu DEMO Grain de Sel',     'ecolieu',              'Nantes',        'Pays de la Loire'),
    (6,  'Habitat DEMO Cour des Arts',    'habitat_participatif', 'Montpellier',   'Occitanie'),
    (7,  'Association DEMO Terre Ouverte','association',          'Grenoble',      'Auvergne-Rhône-Alpes'),
    (8,  'Écolieu DEMO Les Sources',      'ecolieu',              'Quimper',       'Bretagne'),
    (9,  'Habitat DEMO Le Verger',        'habitat_participatif', 'Bordeaux',      'Nouvelle-Aquitaine'),
    (10, 'Tiers-lieu DEMO L''Atelier',    'tiers_lieu',           'Lille',         'Hauts-de-France'),
    (11, 'Habitat DEMO Les Voisins',      'habitat_participatif', 'Dijon',         'Bourgogne-Franche-Comté'),
    (12, 'Écolieu DEMO Chemin Vert',      'ecolieu',              'Rennes',        'Bretagne')
  ) as v(n, name, kind, city, region);

  insert into public.outreach_addresses (id, contact_id, email, person_first_name, person_name, is_role_address, is_primary, source, source_url, source_note, verified_at)
  select ('de200000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         ('de000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         'contact@demo-lieu-' || v.n || '.example.invalid',
         v.first_name, v.person, v.first_name is null, true, v.source,
         case when v.source = 'site_web' then 'https://demo-lieu-' || v.n || '.example.invalid/contact' end,
         'DEMO',
         case when v.n in (9, 10, 11, 12) then now() - interval '3 days' end
  from (values
    (1,  'Camille', 'Camille Roux',   'site_web'),
    (2,  null,      null,             'site_web'),
    (3,  'Sami',    'Sami Benali',    'recommandation'),
    (4,  null,      null,             'annuaire'),
    (5,  'Inès',    'Inès Martin',    'site_web'),
    (6,  null,      null,             'sejour'),
    (7,  'Paul',    'Paul Lefèvre',   'site_web'),
    (8,  null,      null,             'annuaire'),
    (9,  'Nora',    'Nora Petit',     'site_web'),
    (10, 'Yanis',   'Yanis Moreau',   'site_web'),
    (11, null,      null,             'annuaire'),
    (12, 'Lucie',   'Lucie Garnier',  'recommandation')
  ) as v(n, first_name, person, source);

  -- ======================================================================
  -- Program articles-sejour (outbound): 12 threads, one per place
  -- ======================================================================
  insert into public.outreach_threads
    (id, program_id, contact_id, address_id, article_id, initial_subject_id, current_subject_id, email_subject,
     status, closed_reason, needs_leo, needs_leo_reason, needs_leo_since, template_id, personal_line, is_custom,
     first_sent_at, last_outbound_at, first_inbound_at, last_inbound_at, photos_granted_at, follow_up_count,
     created_by, created_at)
  select ('de100000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         p_art,
         ('de000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         ('de200000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         v.article,
         (select id from public.outreach_subjects where program_id = p_art and slug = 'article'),
         (select id from public.outreach_subjects where program_id = p_art and slug = v.subj),
         case when v.custom then 'Une question sur votre potager'
              else 'Vous êtes cité dans « ' || (select title from public.outreach_articles where id = v.article) || ' »' end,
         v.status, v.closed, v.toi is not null, v.toi,
         case when v.toi is not null then now() - make_interval(days => coalesce(v.in_ago, 1)) end,
         v.tpl, v.line, v.custom,
         case when v.sent_ago is not null then now() - make_interval(days => v.sent_ago) end,
         case when v.sent_ago is not null then now() - make_interval(days => coalesce(v.last_out_ago, v.sent_ago)) end,
         case when v.in_ago is not null then now() - make_interval(days => v.in_ago) end,
         case when v.in_ago is not null then now() - make_interval(days => v.in_ago) end,
         case when v.photos then now() - make_interval(days => 4) end,
         v.fu, 'ingest', now() - make_interval(days => v.created_ago)
  from (values
    -- n, article, status, closed, toi, tpl, custom, line, subj, sent_ago, last_out_ago, in_ago, photos, fu, created_ago
    (1,  a1, 'a_valider',  null,      null,        'gabarit-v1', false, 'Votre potager partagé nous a marqués.',                          'article',    null, null, null, false, 0, 3),
    (2,  a1, 'a_valider',  null,      null,        'gabarit-v1', false, 'Nous avons aimé la façon dont vous décrivez les repas communs.', 'article',    null, null, null, false, 0, 2),
    (3,  a1, 'a_valider',  null,      null,        null,         true,  null,                                                              'article',    null, null, null, false, 0, 9),
    (4,  a2, 'a_valider',  null,      null,        'gabarit-v1', false, 'Votre cuisine collective est un bel exemple.',                   'article',    null, null, null, false, 0, 1),
    (5,  a2, 'a_valider',  null,      null,        'gabarit-v1', false, 'La charte de votre habitat nous a inspirés.',                    'article',    null, null, null, false, 0, 1),
    (6,  a1, 'planifie',   null,      null,        'gabarit-v1', false, 'Votre jardin partagé est cité dans le troisième passage.',       'article',    null, null, null, false, 0, 4),
    (7,  a1, 'envoye',     null,      null,        'gabarit-v1', false, 'Vos ateliers de réparation ouverts au quartier.',                'article',    5,    null, null, false, 0, 6),
    (8,  a1, 'relance',    null,      null,        'gabarit-v1', false, 'Votre salle commune ouverte le dimanche.',                       'article',    12,   2,    null, false, 1, 13),
    (9,  a2, 'a_repondu',  null,      'auto_coupe','gabarit-v1', false, 'Votre atelier cuisine du jeudi.',                                'article',    8,    null, 2,    false, 0, 9),
    (10, a2, 'partenaire', null,      null,        'gabarit-v1', false, 'Votre verger partagé.',                                          'photos',     10,   null, 4,    true,  0, 11),
    (11, a2, 'clos',       'refus',   null,        'gabarit-v1', false, 'Votre règlement intérieur.',                                     'article',    15,   null, 13,   false, 0, 16),
    (12, a1, 'a_repondu',  null,      'zone_rouge','gabarit-v1', false, 'Le passage sur votre ouverture en 2011.',                        'correction', 6,    null, 1,    false, 0, 7)
  ) as v(n, article, status, closed, toi, tpl, custom, line, subj, sent_ago, last_out_ago, in_ago, photos, fu, created_ago);

  -- First mail of each thread. Drafts and the queued one are outbound
  -- messages by Leo; the others are already sent.
  insert into public.outreach_messages
    (id, thread_id, direction, kind, message_id, to_email, subject, body_text, draft_text, draft_source,
     send_status, author, approved_by, approved_at, scheduled_for, sent_at, appended_to_sent, created_at)
  select ('de500000-0000-4000-8000-' || lpad(t.n::text, 12, '0'))::uuid,
         t.id, 'out', 'initial',
         case when t.status not in ('a_valider', 'planifie') then 'o.demo-init-' || t.n || '@casaminga.com' end,
         'contact@demo-lieu-' || t.n || '.example.invalid',
         t.email_subject, t.body, t.body, 'ingest',
         case when t.status = 'a_valider' then 'a_valider' when t.status = 'planifie' then 'planifie' else 'envoye' end,
         'leo',
         case when t.status <> 'a_valider' then 'demo' end,
         case when t.status <> 'a_valider' then now() - interval '1 day' end,
         case when t.status = 'planifie' then now() + interval '1 hour' end,
         t.first_sent_at,
         t.status not in ('a_valider', 'planifie'),
         t.created_at
  from (
    select th.*, (regexp_replace(th.id::text, '^.*-0*', ''))::int as n,
           case when th.is_custom then
                  E'Bonjour,\n\nJe suis tombé sur votre potager en préparant un article et je voulais vous écrire à la main : ' ||
                  E'comment faites-vous pour que les récoltes soient partagées sans conflit ?\n\nLéo'
                else
                  format(E'Bonjour,\n\nL''article « %s » cite %s. %s\n\nSi tu le souhaites, tu peux nous accorder l''usage des photos du lieu.\n\nLéo',
                         (select title from public.outreach_articles where id = th.article_id),
                         (select name from public.outreach_contacts where id = th.contact_id),
                         th.personal_line)
           end as body
    from public.outreach_threads th
    where th.program_id = p_art
  ) t;

  -- Follow-up drafts (validated with the first mail for the queued thread) and the sent follow-up of thread 8.
  insert into public.outreach_messages
    (id, thread_id, direction, kind, message_id, to_email, subject, body_text, draft_text, draft_source,
     send_status, author, approved_by, approved_at, sent_at, created_at)
  select ('de510000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
         ('de100000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
         'out', 'relance',
         case when n = 8 then 'o.demo-relance-8@casaminga.com' end,
         'contact@demo-lieu-' || n || '.example.invalid',
         'Re: Vous êtes cité dans notre article',
         E'Bonjour,\n\nJe me permets un petit rappel au sujet de notre message : rien ne presse.\n\nLéo',
         E'Bonjour,\n\nJe me permets un petit rappel au sujet de notre message : rien ne presse.\n\nLéo',
         'ingest',
         case when n = 8 then 'envoye' else 'a_valider' end,
         'leo',
         case when n in (6, 8) then 'demo' end,
         case when n in (6, 8) then now() - interval '5 days' end,
         case when n = 8 then now() - interval '2 days' end,
         now() - interval '3 days'
  from unnest(array[1, 2, 4, 5, 6, 8]) as n;

  -- Inbound replies, with fictional AI readings.
  insert into public.outreach_messages
    (id, thread_id, direction, kind, message_id, from_email, to_email, subject, body_text, body_reply, received_at,
     match_method, ai_subject_id, ai_intent, ai_confidence, ai_zone_rouge, ai_red_zones, ai_opt_out, ai_summary, ai_draft,
     ai_decision, ai_decision_reasons, ai_context_version, ai_model, classified_at, created_at)
  select ('de400000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         ('de100000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         'in', 'entrant', 'demo-in-' || v.n || '@mail.example.invalid',
         'contact@demo-lieu-' || v.n || '.example.invalid', 'leo@casaminga.com',
         'Re: Vous êtes cité dans notre article',
         v.reply || E'\n\nLe jeudi, Léo Durand a écrit :\n> Bonjour, l''article cite votre lieu...\n> Léo',
         v.reply,
         now() - make_interval(days => v.in_ago), 'in_reply_to',
         (select id from public.outreach_subjects where program_id = p_art and slug = v.subj),
         v.intent, v.conf, v.zone, v.zones, false, v.summary, v.draft,
         'a_toi', v.reasons, 1, 'demo (fictif)', now() - make_interval(days => v.in_ago), now() - make_interval(days => v.in_ago)
  from (values
    (9,  2, E'Merci beaucoup pour l''article, ça nous fait très plaisir ! Où peut-on le lire en entier ?', 'article', 'remerciement', 0.93::numeric, false, array[]::text[],
         'Le lieu remercie et demande où lire l''article en entier.',
         E'Merci pour ton message ! L''article est en ligne ici : https://sejour.casaminga.com/ressources/demo-cuisiner-ensemble\n\nLéo', array['auto_coupe']),
    (10, 4, E'Avec plaisir pour les photos, on vous les envoie cette semaine.', 'photos', 'accord_photos', 0.97::numeric, false, array[]::text[],
         'Le lieu accepte que Casa Minga utilise ses photos.',
         E'Super, merci ! Le plus simple est de passer par le lien « Photos » du premier mail pour choisir la licence et le crédit.\n\nLéo', array['auto_coupe']),
    (11, 13, E'Merci, mais nous préférons ne pas figurer dans vos contenus.', 'article', 'refus', 0.90::numeric, false, array[]::text[],
         'Le lieu refuse d''être cité.',
         E'Merci de nous l''avoir dit, nous respectons votre choix.\n\nLéo', array['auto_coupe']),
    (12, 1, E'Bonjour, une erreur s''est glissée : notre lieu a ouvert en 2012, pas en 2011. Pouvez-vous corriger ?', 'correction', 'demande_correction', 0.88::numeric, true, array['modification_article'],
         'Le lieu signale une erreur de date et demande une correction de l''article.',
         E'Merci de nous le signaler, je vérifie et je te confirme.\n\nLéo', array['zone_rouge'])
  ) as v(n, in_ago, reply, subj, intent, conf, zone, zones, summary, draft, reasons);

  -- A photo grant for the partner thread (fictional, no file).
  insert into public.outreach_photo_grants
    (id, thread_id, contact_id, licence, credit, granted_by_name, granted_by_role, scope, consent_text, consent_version, consent_sha256, accepted_at)
  values ('de600000-0000-4000-8000-000000000010', 'de100000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000010',
          'CC-BY-4.0', 'Tiers-lieu DEMO L''Atelier', 'Personne fictive', 'DEMO', 'photos_article',
          'DEMO, texte de consentement fictif', 'demo-1', repeat('a', 64), now() - interval '4 days');

  -- ======================================================================
  -- Program sav-sejour (inbound): 5 threads
  -- ======================================================================
  insert into public.outreach_threads
    (id, program_id, contact_id, address_id, initial_subject_id, current_subject_id, email_subject, status, closed_reason,
     needs_leo, needs_leo_reason, needs_leo_since, first_inbound_at, last_inbound_at, first_response_at, last_outbound_at,
     sla_due_at, resolved_at, created_by, created_at)
  select ('de300000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         p_sav,
         ('de000000-0000-4000-8000-' || lpad(v.contact::text, 12, '0'))::uuid,
         ('de200000-0000-4000-8000-' || lpad(v.contact::text, 12, '0'))::uuid,
         (select id from public.outreach_subjects where program_id = p_sav and slug = v.subj),
         (select id from public.outreach_subjects where program_id = p_sav and slug = v.subj),
         v.title, v.status, v.closed,
         v.toi is not null, v.toi, case when v.toi is not null then now() - interval '2 days' end,
         now() - make_interval(days => v.in_ago), now() - make_interval(days => v.in_ago),
         case when v.responded then now() - make_interval(days => v.in_ago - 1) end,
         case when v.responded then now() - make_interval(days => v.in_ago - 1) end,
         now() - make_interval(days => v.in_ago) + make_interval(hours => v.sla_h),
         case when v.status = 'resolu' then now() - interval '2 days' end,
         'formulaire', now() - make_interval(days => v.in_ago)
  from (values
    (1, 3,  'recu',     null,     'sla_depasse', 'points_hospitalite', 'Mes points d''hospitalité ont disparu',  2, false, 42),
    (2, 7,  'en_cours', null,     null,          'sejour',             'Question sur les dates de mon séjour',   3, true,  48),
    (3, 9,  'resolu',   null,     null,          'compte',             'Je n''arrive plus à me connecter',       5, true,  48),
    (4, 12, 'clos',     'resolu', null,          'echange',            'Échange annulé par mon hôte',            12, true, 48),
    (5, 1,  'recu',     null,     null,          'compte',             'Comment faire vérifier mon compte ?',    0, false, 40)
  ) as v(n, contact, status, closed, toi, subj, title, in_ago, responded, sla_h);

  -- Inbound messages of the SAV threads (thread 5 is not read by the AI yet).
  insert into public.outreach_messages
    (id, thread_id, direction, kind, message_id, from_email, to_email, subject, body_text, body_reply, received_at, match_method,
     ai_subject_id, ai_intent, ai_confidence, ai_zone_rouge, ai_red_zones, ai_opt_out, ai_summary, ai_draft, ai_decision,
     ai_decision_reasons, ai_context_version, ai_model, classified_at, created_at)
  select ('de410000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         ('de300000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         'in', case when v.n = 1 then 'formulaire' else 'entrant' end,
         'demo-sav-in-' || v.n || '@mail.example.invalid',
         'contact@demo-lieu-' || v.contact || '.example.invalid', 'contact@sejour.casaminga.com',
         v.title, v.body, v.body, now() - make_interval(days => v.in_ago), case when v.n = 1 then 'formulaire' else 'nouveau_fil' end,
         case when v.read then (select id from public.outreach_subjects where program_id = p_sav and slug = v.subj) end,
         case when v.read then v.intent end, case when v.read then v.conf end,
         case when v.read then false end, '{}'::text[], case when v.read then false end,
         case when v.read then v.summary end, case when v.read then v.draft end,
         case when v.read then 'a_toi' end, case when v.read then v.reasons else '{}'::text[] end,
         null::int, case when v.read then 'demo (fictif)' end,
         case when v.read then now() - make_interval(days => v.in_ago) end, now() - make_interval(days => v.in_ago)
  from (values
    (1, 3,  2, 'Mes points d''hospitalité ont disparu',  E'Bonjour, mon solde de points est à zéro depuis hier alors que j''avais reçu des points. Que s''est-il passé ?', true,
         'points_hospitalite', 'solde_a_zero', 0.62::numeric, 'Le membre ne retrouve plus ses points d''hospitalité.',
         E'Bonjour, merci de votre message. Nous vérifions votre solde et revenons vers vous.', array['confiance']),
    (2, 7,  3, 'Question sur les dates de mon séjour',   E'Bonjour, je voudrais décaler mon séjour d''une semaine, est-ce possible ?', true,
         'sejour', 'modifier_dates', 0.90::numeric, 'Le membre veut décaler son séjour d''une semaine.',
         E'Bonjour, oui, vous pouvez proposer de nouvelles dates directement à votre hôte depuis la page du séjour.', array['auto_coupe']),
    (3, 9,  5, 'Je n''arrive plus à me connecter',       E'Bonjour, mon mot de passe ne fonctionne plus.', true,
         'compte', 'connexion', 0.95::numeric, 'Le membre ne peut plus se connecter.',
         E'Bonjour, utilisez le lien « Mot de passe oublié » sur la page de connexion.', array['auto_coupe']),
    (4, 12, 12, 'Échange annulé par mon hôte',           E'Bonjour, mon hôte a annulé notre échange, que faire ?', true,
         'echange', 'annulation_hote', 0.86::numeric, 'Le membre demande quoi faire après l''annulation de son échange.',
         E'Bonjour, nous sommes désolés. Vous pouvez proposer un nouvel échange à un autre lieu.', array['auto_coupe']),
    (5, 1,  0, 'Comment faire vérifier mon compte ?',    E'Bonjour, comment obtenir le badge Vérifié ?', false, null, null, null::numeric, null, null, array[]::text[])
  ) as v(n, contact, in_ago, title, body, read, subj, intent, conf, summary, draft, reasons);

  -- Team replies of the SAV threads 2, 3 and 4.
  insert into public.outreach_messages
    (id, thread_id, direction, kind, message_id, to_email, subject, body_text, draft_text, draft_source,
     send_status, author, approved_by, approved_at, sent_at, reply_to_message_id, modified_by_leo, appended_to_sent, created_at)
  select ('de520000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         ('de300000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
         'out', 'reponse', 'o.demo-sav-' || v.n || '@casaminga.com',
         'contact@demo-lieu-' || v.contact || '.example.invalid',
         'Re: ' || v.title, v.reply, v.reply, 'leo',
         'envoye', 'leo', 'demo', now() - make_interval(days => v.ago), now() - make_interval(days => v.ago),
         ('de410000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid, false, true, now() - make_interval(days => v.ago)
  from (values
    (2, 7,  'Question sur les dates de mon séjour', 2, E'Bonjour, oui, vous pouvez proposer de nouvelles dates à votre hôte depuis la page du séjour.\n\nL''équipe Casa Minga'),
    (3, 9,  'Je n''arrive plus à me connecter',     4, E'Bonjour, utilisez le lien « Mot de passe oublié ». Dites-nous si cela règle le problème.\n\nL''équipe Casa Minga'),
    (4, 12, 'Échange annulé par mon hôte',          11, E'Bonjour, nous sommes désolés. Vous pouvez proposer un nouvel échange à un autre lieu.\n\nL''équipe Casa Minga')
  ) as v(n, contact, title, ago, reply);

  -- ---- Journal: what the weekly and mailbox-health views count ---------------
  insert into public.outreach_events (occurred_at, program_id, thread_id, contact_id, actor, type, data)
  select t.created_at, p_art, t.id, t.contact_id, 'ingest', 'ingest.draft',
         jsonb_build_object('source', 'skill', 'article', 'demo', 'prepared_by', 'demo', 'template', t.template_id, 'custom', t.is_custom)
  from public.outreach_threads t where t.program_id = p_art;

  insert into public.outreach_events (occurred_at, program_id, thread_id, contact_id, message_id, actor, type, data)
  select m.sent_at, p_art, m.thread_id, t.contact_id, m.id, 'cron', 'message.sent',
         jsonb_build_object('kind', m.kind, 'author', m.author)
  from public.outreach_messages m join public.outreach_threads t on t.id = m.thread_id
  where t.program_id = p_art and m.direction = 'out' and m.send_status = 'envoye';

  insert into public.outreach_events (occurred_at, program_id, thread_id, contact_id, message_id, actor, type, data)
  select m.received_at, t.program_id, m.thread_id, t.contact_id, m.id, 'imap', 'inbound.received', jsonb_build_object('match_method', m.match_method)
  from public.outreach_messages m join public.outreach_threads t on t.id = m.thread_id
  where m.direction = 'in' and t.contact_id in (select id from public.outreach_contacts where 'demo' = any(tags));

  insert into public.outreach_events (occurred_at, program_id, thread_id, contact_id, actor, type, data)
  select t.created_at, p_sav, t.id, t.contact_id, 'imap', 'thread.opened', jsonb_build_object('source', 'formulaire')
  from public.outreach_threads t where t.program_id = p_sav;

  insert into public.outreach_events (occurred_at, program_id, thread_id, contact_id, message_id, actor, type, data)
  select m.sent_at, p_sav, m.thread_id, t.contact_id, m.id, 'cron', 'message.sent', jsonb_build_object('kind', 'reponse', 'author', 'leo')
  from public.outreach_messages m join public.outreach_threads t on t.id = m.thread_id
  where t.program_id = p_sav and m.direction = 'out' and m.send_status = 'envoye';
end
$seed$;
