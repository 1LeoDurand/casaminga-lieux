-- Cartes initiales de la feuille de route, reprises du backlog accumulé
-- (ROADMAP.md B1-B6, chantiers centre d aide / subventions / modules).
-- Appliqué en production le 08/09/2026.

insert into public.platform_tasks (title, description, status, priority, effort, roadmap_ref) values
('Repasser le dépôt GitHub en privé, avec clé de déploiement', 'Le dépôt a été rendu public le 03/09 pour débloquer le build Infomaniak, et il l''est resté. Vérifié : aucune clé ni fichier .env dans l''historique, donc pas de fuite — mais le code source est exposé.

Remède : ssh-keygen sur le slot, ajouter la clé publique dans GitHub > Settings > Deploy keys en LECTURE SEULE, puis git remote set-url origin git@github.com:1LeoDurand/casaminga-lieux.git. Le git pull du bouton Build refonctionnera avec un dépôt fermé.', 'valide', 'haute', 'XS', null),
('Prévenir Bernard Kohn : IBAN et BIC publiés sur leur page d''accueil', 'Les coordonnées bancaires de l''association apparaissent dans l''accroche de leur site public. Ils ne le savent probablement pas. À leur signaler pour qu''ils décident — ce n''est pas à nous de modifier leur contenu.', 'valide', 'haute', 'XS', null),
('Doublon de cash_add_entry : l''annulation d''écriture est cassée', 'Deux surcharges coexistent (12 et 14 paramètres). voidCashEntry ne passe aucun paramètre distinctif, PostgREST ne tranche pas entre les deux candidates. Défaut latent : 0 annulation sur 4 écritures, jamais exercé.

Le payload de hachage est identique entre les deux versions, la suppression de l''ancienne n''affecte donc aucune écriture existante. À faire AVANT de toucher à l''interface de caisse.', 'valide', 'haute', 'XS', 'B3'),
('Next.js 16.3.4 — contournement de middleware App Router', '16.2.6 porte un avis élevé « Middleware / Proxy bypass in App Router », plus deux SSRF (Server Actions, rewrites). Sur une app multi-tenant où proxy.ts route par domaine, c''est le point sérieux.

16.3.4 corrige next, sharp et postcss d''un coup, et c''est une montée mineure. Impose un rebuild et un redéploiement.', 'valide', 'haute', 'S', 'B4'),
('Déployer les 7 commits en attente', 'De ba1bb7f à de6fe0d : correctif Gemini, correctifs de l''audit de septembre (focus du formulaire de gouvernance, liens internes, lint recentré), backlog B2-B6, tableau kanban glissable et feuille de route.

Rappel de la procédure : bouton Build du manager Infomaniak, puis Run. Vérifier .next/BUILD_ID, pas le message « Command succeeded » qui ment. Ne JAMAIS lancer npm ci en SSH sans avoir fait mv node_modules node_modules.bak avant.', 'a_deployer', 'haute', 'XS', null),
('Lien de paiement par carte sur les factures', 'Encaisser une facture en un clic, réduire les impayés (8 « à relancer »). L''infra Stripe Connect existe déjà, rien à créer côté Stripe. Détail complet dans ROADMAP.md.', 'a_trier', 'normale', 'M', 'B1'),
('Interface de caisse type comptoir (POS)', 'Rendre la caisse utilisable au comptoir par un bénévole. Le manque réel n''est pas visuel, c''est le panier : aujourd''hui un clic = un encaissement scellé.

Contrainte NF525 : ticket_ref dérive de seq, deux écritures ne peuvent jamais partager un ticket. Le point d''accroche est source_ref, seul champ libre exclu du payload de hash. Architecture détaillée dans ROADMAP.md.', 'a_trier', 'normale', 'L', 'B2'),
('Variables NEXT_PUBLIC_ absentes du serveur', 'APP_URL, SITE_URL, PUBLIC_SITE_URL et CUSTOM_DOMAIN_TARGET_IP manquent dans .env et .env.local du slot. Chaque usage retombe sur une valeur par défaut, donc rien ne plante — la panne est silencieuse. Visible : la page d''aide au domaine personnalisé affiche une IP vide.

Figées au build : nécessite un rebuild, pas un simple redémarrage.', 'a_trier', 'normale', 'XS', 'B5'),
('Dette de lint restante — rendre le lint bloquant en CI', '40 erreurs après recentrage de no-unescaped-entities (contre 339). Dont 15 faux positifs (lecture de localStorage au montage) et 2 liens <a> volontaires. Décider règle par règle, puis rendre le lint bloquant.', 'a_trier', 'basse', 'S', 'B6'),
('Centre d''aide : images dans renderMarkdown', 'Première brique avant toute capture d''écran : renderMarkdown gère gras, code, liens, listes et citations, mais PAS les images. Sans ça, aucun article illustré n''est possible.', 'a_trier', 'normale', 'S', null),
('Centre d''aide : organisation de démonstration + captures', 'Créer une org de démonstration avec des données fictives, puis scripter les captures avec Playwright. Ne JAMAIS utiliser les données d''un vrai lieu : le site de Bernard Kohn publie son IBAN, ce qui règle la question.

Pièges déjà rencontrés : le bandeau cookies masque le contenu (poser localStorage.cookie_consent), et le thème local diffère de la production (applyHostTheme force « chaleureux » sur casaminga.com).', 'a_trier', 'normale', 'M', null),
('Subventions : enregistrer les brouillons IA', 'grant_applications n''a aucun champ pour stocker le brouillon généré : il est perdu au rechargement de la page. Le travail de l''utilisateur disparaît.', 'a_trier', 'normale', 'S', null),
('Subventions : extraire les montants de subvention_comment', 'Sur 1261 aides importées : date limite renseignée à 27 %, montant à 0,08 % (1 seule aide), pièces et étapes à 0 %. amount_min/max et required_documents sont codés en dur à vide dans le mapping d''import. Sans montant, impossible de trier ou de filtrer utilement.', 'a_trier', 'normale', 'M', null),
('Subventions : tri par date limite', '27 % des aides ont une date limite renseignée — assez pour que le tri soit utile à un chargé de subvention qui cherche ce qui expire bientôt.', 'a_trier', 'basse', 'XS', null),
('Cloisonnement des modules : enabled vs entitled', 'Le cloisonnement est aujourd''hui cosmétique : minTier n''est lu que dans dashboard-sidebar, et 3 pages de dashboard sur 47 consultent les modules. La table subscriptions est vide (0 ligne pour 13 orgs).

À faire : séparer « activé » de « autorisé », écrire un requireModule() posé sur les 47 pages, un composant de paywall unique, et créer les lignes subscriptions avec founding_member = true pour les orgs bêta.', 'a_trier', 'normale', 'L', null),
('Newsletter : backlog MailPoet', 'Reliquat consigné dans le ticket feedback cffb436b, après la mise en conformité (RFC 8058, consentement RGPD, anti double-envoi, suivi des ouvertures et clics).', 'a_trier', 'basse', 'M', null),
('Vérifier l''en-tête List-Unsubscribe dans une vraie boîte Gmail', 'La conformité RFC 8058 est codée et scellée par 14 assertions SQL en production, mais l''en-tête n''a jamais été observé dans un client de messagerie réel. Un premier envoi de newsletter après déploiement suffira.', 'a_trier', 'normale', 'XS', null);
