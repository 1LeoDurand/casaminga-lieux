-- outreach-knowledge-seed.sql
--
-- First entries of the knowledge base of the contacts AI (spec 7.1 bloc C, step 7):
-- three public pages of sejour.casaminga.com, shared by every program.
-- Texts read on the live site on 2026-09-29 (pages rendered in a browser; the
-- site is a SPA, so a plain fetch returns an empty shell). Rewritten faithfully,
-- nothing added. The pages are short: the entries are complete, not summaries.
--
-- NOT EXECUTED by the step 7 agent. To apply after Leo has read them:
--   run this file in the SQL editor of the admin project, then review each
--   entry in /admin/contacts/reglages?onglet=connaissances and switch it on.
--
-- The entries are inserted INACTIVE and unreviewed on purpose: the AI only
-- quotes what Leo has read and activated. Re-running the script adds nothing
-- (one entry per source_url).
--
-- POINT FOR LEO BEFORE ACTIVATING "comment-ca-marche": the page says
-- "Gratuit jusqu'en juin 2026" and "A partir de juin 2026 ... cotisation
-- annuelle". Today is 2026-09-29: the wording is out of date on the site itself.
-- Any question about price or subscription is a red zone (argent) anyway, but
-- fix the page or the entry before switching it on.

insert into public.outreach_knowledge (program_id, kind, title, body, source_url, active, reviewed_at, created_by)
select null, 'page', v.title, v.body, v.url, false, null, 'seed'
from (values
(
  'Comment ça marche (sejour.casaminga.com)',
  'https://sejour.casaminga.com/comment-ca-marche',
  $b1$Casa Minga permet de découvrir des habitats participatifs, de proposer un séjour dans un lieu de vie collectif et de voyager autrement. La page de présentation annonce : « Gratuit jusqu'en juin 2026 » (voir la remarque du fichier seed avant activation).

Les étapes pour démarrer, en quatre temps.
1. Créer son profil et son lieu : ajouter son profil, présenter son habitat participatif, son coliving ou son lieu collectif.
2. Compléter sa fiche : une description, des photos, les valeurs du lieu, son ambiance et les possibilités d'accueil.
3. Publier ses séjours ou explorer les lieux : proposer une chambre, un logement ou un séjour immersif, ou découvrir les lieux déjà présents sur Casa Minga.
4. Se connecter et préparer son séjour : envoyer une demande, échanger avec le lieu ou l'hôte, et organiser un séjour au cœur d'un collectif.

Tarification, telle que la page la décrit. Casa Minga est présenté comme gratuit pour permettre aux premiers lieux et aux premiers membres de rejoindre le réseau, de créer leur fiche et de commencer à proposer des séjours. Ensuite, le réseau fonctionnerait sur une cotisation annuelle permettant de publier, de recevoir des demandes et de participer pleinement au réseau, sans frais par nuit ni commission par séjour.

Les quatre types de séjour qu'un lieu peut proposer : la chambre privée (dans un lieu collectif, une chambre avec un hôte engagé) ; le logement indépendant (au sein d'un habitat participatif) ; le séjour immersif (participer à la vie du collectif pendant quelques jours) ; l'accueil ponctuel (un membre du collectif ouvre sa porte pour une visite brève).

Pourquoi Casa Minga, en trois raisons. Des lieux habités par des valeurs : écologie, partage, sobriété, chaque lieu porte un projet de vie. Un cadre plus humain : pas de commission, pas de logique de marché, du lien authentique. De vrais collectifs : chaque fiche correspond à un lieu existant, vérifié et habité.

Deux actions proposées sur la page : créer sa fiche, explorer les lieux. Pied de page : « La maison de l'entraide. Un réseau de lieux habités où des collectifs s'accueillent. »$b1$
),
(
  'Charte de l''hospitalité (sejour.casaminga.com)',
  'https://sejour.casaminga.com/charte',
  $b2$La charte de l'hospitalité rassemble quelques engagements simples qui font tenir la confiance entre tous les membres de Casa Minga. En rejoignant Casa Minga, chaque membre adhère à cette charte. Elle n'est pas un contrat, mais une boussole commune.

Pour tous. La bienveillance et le respect mutuel priment sur tout le reste. Aucune discrimination n'est tolérée, sous aucune forme. L'échange se fait sans contrepartie financière : c'est la réciprocité qui fait vivre le réseau. En cas de désaccord, on privilégie le dialogue, et le signalement si nécessaire.

En tant qu'hôte, je m'engage à : accueillir avec sincérité, présenter le lieu, ses espaces communs et son fonctionnement ; être clair en amont sur ce qui est partagé (repas, tâches, règles de vie) et sur ce qui ne l'est pas ; respecter l'intimité et le rythme des personnes accueillies ; décrire honnêtement son lieu, sans promesse exagérée ni mauvaise surprise.

En tant que voyageur, je m'engage à : venir dans un esprit d'échange plutôt que de consommation, et participer à la vie du lieu quand c'est proposé ; respecter les règles, les espaces et les habitants, comme on respecterait un ami qui nous reçoit ; communiquer clairement ses dates, ses besoins et toute annulation, au plus tôt ; laisser le lieu tel qu'on aimerait le trouver, et témoigner honnêtement après le séjour.$b2$
),
(
  'L''hospitalité entre collectifs (sejour.casaminga.com)',
  'https://sejour.casaminga.com/hospitalite',
  $b3$L'hospitalité que défend Casa Minga est une autre idée du voyage : non pas consommer un lieu, mais être accueilli par celles et ceux qui le font vivre. Le tourisme classique met une distance entre l'hôte et le visiteur : l'un sert, l'autre paie. L'hospitalité de Casa Minga repose sur l'inverse : l'égalité, le don, la rencontre. On s'accueille entre collectifs parce qu'on partage une même manière d'habiter le monde.

Ce lien se vit autour d'une table, dans un jardin partagé, lors d'un chantier collectif ou d'une simple conversation au coin du feu. C'est dans ces moments que naissent les amitiés, les idées et parfois des projets qui essaiment d'un lieu à l'autre.

Trois piliers. Accueillir, pas héberger : recevoir un voyageur, ce n'est pas mettre une chambre à disposition, c'est partager un repas, une veillée, le quotidien d'un lieu, et laisser une vraie rencontre se produire. La réciprocité plutôt que l'argent : chez Casa Minga, on s'accueille sans payer ; aujourd'hui hôte, demain voyageur, l'échange circule, ce qui crée un réseau de confiance entre collectifs. Entre pairs qui se comprennent : les habitants d'écolieux et d'habitats participatifs partagent des questionnements communs ; s'accueillir entre eux, c'est échanger des pratiques, s'inspirer et se sentir compris.

Cette hospitalité s'appuie sur des engagements partagés, décrits dans la charte de l'hospitalité (https://sejour.casaminga.com/charte).$b3$
)
) as v(title, url, body)
where not exists (
  select 1 from public.outreach_knowledge k where k.source_url = v.url and k.program_id is null
);
