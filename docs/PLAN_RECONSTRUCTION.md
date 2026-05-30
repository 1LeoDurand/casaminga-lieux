# Plan de reconstruction — `admin.casaminga.com`

> **Statut : proposition à valider.** Document de travail. Aucun module n'est démarré
> tant que (1) ce plan n'est pas validé et (2) le shell dashboard **v1.3.1** n'est pas
> validé visuellement. Périmètre strict : `admin.casaminga.com` uniquement.
> `casaminga.com` et `sejour.casaminga.com` ne sont **pas** touchés.

## Principes directeurs

- **Fidélité Claude Design** : on reprend l'export officiel (`Plateforme.html`) écran par écran,
  composant par composant. On ne réinvente pas l'interface, on ne dégrade pas le design.
- **Fondation propre** : Next.js (App Router) + Supabase. **Supabase = source de vérité.**
  `localStorage` réservé aux préférences d'UI.
- **Progressif & sûr** : **un module = une version**. Pas de big-bang, pas d'usine à gaz,
  pas de placeholder inutile. On ne casse jamais un module déjà livré.
- **Sécurité** : isolation multi-tenant par `organization_id` + RLS (`is_org_member`).
  La clé `service_role` n'est **jamais** exposée côté front.

## Conventions transverses (valables pour chaque version)

- **Migrations** : une migration SQL **idempotente** par module (`0002_personnes.sql`,
  `0003_espaces.sql`, …), appliquée via le **SQL Editor** (méthode v1.2) + un `verify.sql`.
  Chaque table : `organization_id` + RLS adossée à `is_org_member(org)`. Lecture publique
  uniquement via policies explicites (modèle `public_sites` / `requests`).
- **Accès données** : tout passe par `src/lib/data.ts` (démo ⇆ Supabase), jamais de
  `service_role` côté client. Pas de `.select()` de retour quand aucune policy SELECT
  n'existe (cf. gotcha RLS des Demandes).
- **UI kit** : on réutilise et on **étend progressivement** la couche `mc-*` posée en v1.3
  (`page-header`, `mc-badge`, `kpi-tile`, `mc-card`, `mc-btn-*`, `mc-quickbar`, blocs dash,
  nav). Toute primitive nouvelle (table, filtres, drawer, calendrier…) est ajoutée une fois
  puis mutualisée.
- **États obligatoires par écran** : **vide** (`mc-empty`), **loading** (`mc-skeleton`),
  **erreur** (message + retry, jamais d'écran blanc), **succès** (toast `sonner`).
- **Branchement dashboard** : chaque module alimente le cockpit (KPI + bloc « Aujourd'hui »)
  avec ses **vraies** données au moment où il est livré (remplace l'illustratif démo).
- **Règle de sortie (stricte, à chaque version)** :
  1. vérifier l'archive de la version précédente ;
  2. coder **uniquement** le module concerné ;
  3. `npm run build` ✅ ; 4. `npm run lint` ✅ ;
  5. commit `vX.Y - <module> fidèle Claude Design + Supabase` ;
  6. tag `vX.Y-<module>` ; 7. **archive depuis le tag** (`git archive`).

## Extension progressive de l'UI kit

| Palier | Primitives ajoutées (réutilisées ensuite partout) |
| --- | --- |
| v1.3 (fait) | page-header, badges, boutons, kpi-tile, cartes, quickbar, sidebar, topbar, toast |
| v1.4 Demandes | **table** (`mc-table`), **barre de filtres** (recherche + statut), **drawer détail**, **dialogue de confirmation** (`mc-confirm`), **état vide** (`mc-empty`), **skeleton** |
| v1.5 Personnes | avatar, chips/tags, **vue cartes** + **bascule de vue** (liste/cartes) |
| v1.6 Espaces | **grille de cartes avec photos**, gestion d'image (Storage) |
| v1.7 Réservations | **vue calendrier / semaine**, **kanban** (statuts) |
| v1.8 Événements | calendrier + cartes + table d'inscriptions (réutilise) |
| v1.10 Documents | **upload fichier** (Supabase Storage), ligne-fichier, visionneuse |
| v1.11 Finances | **graphiques barres**, format monétaire, table de factures |
| v1.12 Médiathèque | **grille média** + lightbox + upload |
| v1.15+ | réutilisation quasi exclusive des primitives existantes |

## Carte des dépendances

```
Personnes ─────┬─→ Demandes (conversion)      Espaces ──┬─→ Réservations
               ├─→ Réservations                          ├─→ Résidences
               ├─→ Événements                            ├─→ Événements
               ├─→ Résidences                            └─→ Impact
               ├─→ Documents (signataires)
               ├─→ Finances (payeurs)          Médiathèque ─┬─→ Site public
               ├─→ Communication                            ├─→ Communication
               ├─→ Gouvernance                              └─→ Événements
               └─→ Partenaires (contacts)
Finances ←── Réservations / Résidences / Événements / Documents
Impact ←──── agrège (presque) tous les modules     → AVANT-DERNIER
Automatisations ←── agit sur tous les modules       → DERNIER
```

## Ordre recommandé & versions

| Version | Module | Tier | Dépend de | Priorité |
| --- | --- | --- | --- | --- |
| v1.3 ✅ / v1.3.1 | **Dashboard (shell)** | Socle | — | faite / en validation |
| v1.4 | **Demandes** (refonte) | 1 Fondations | (existe) | ⭐ très haute |
| v1.5 | **Personnes** | 1 Fondations | — | ⭐ très haute |
| v1.6 | **Espaces** | 1 Fondations | — | ⭐ très haute |
| v1.7 | **Réservations** | 2 Activité | Espaces, Personnes | ⭐ haute |
| v1.8 | **Événements** | 2 Activité | Espaces, Personnes | ⭐ haute |
| v1.9 | **Résidences** | 2 Activité | Espaces, Personnes | moyenne |
| v1.10 | **Documents** | 3 Administration | Personnes | moyenne |
| v1.11 | **Finances** | 3 Administration | Personnes, Réservations/Résidences/Événements | ⭐ haute |
| v1.12 | **Médiathèque** | 4 Rayonnement | — (alimente Site/Comm) | moyenne |
| v1.13 | **Site public (Vitrine)** | 4 Rayonnement | Espaces, Événements, Médiathèque | ⭐ haute |
| v1.14 | **Communication** | 4 Rayonnement | Personnes, Médiathèque | moyenne |
| v1.15 | **Gouvernance** | 5 Collectif | Personnes | moyenne |
| v1.16 | **Partenaires** | 5 Collectif | Personnes | basse |
| v1.17 | **Tâches & alertes** | 6 Transverse | (réfère tous) | moyenne |
| v1.18 | **Paramètres** | 6 Transverse | organizations / members | moyenne |
| v1.19 | **Impact** | 6 Pilotage | agrège la plupart | basse (après données) |
| v1.20 | **Automatisations** | 6 Pilotage | tous les modules | basse (en dernier) |
| v1.21 | **Dashboard (consolidation)** | Pilotage | tous | finalisation |

---

# Détail par module (10 points)

## v1.3 / v1.3.1 — Dashboard (shell)
1. **Métier** : cockpit opérationnel ; point d'entrée, synthèse du jour, accès rapide.
2. **Écrans** : vue d'ensemble (header + quickbar + rangée KPI + « Aujourd'hui » + récents).
3. **UI Claude Design** : sidebar (Pilotage/Gestion/Structure/Publication/Système, DÉMO),
   topbar, kpi-tile, blocs dash, page-header. **Fait.**
4. **Tables** : aucune en propre (lit les autres). 
5. **Relations** : agrège tous les modules.
6. **Actions** : navigation, actions rapides, ouverture des modules.
7. **États** : vide (peu de données), loading, erreur, succès.
8. **Dashboard** : KPI + tuiles « Aujourd'hui » (réelles dès que chaque module arrive).
9. **Vigilance** : ne pas figer de fausses données ; brancher au fil des versions.
10. **Version** : v1.3 (fait), v1.3.1 (fix CSS, en validation), v1.21 (consolidation).

## v1.4 — Demandes (refonte fidèle)
1. **Métier** : pont site public → équipe ; centraliser et qualifier les demandes entrantes.
2. **Écrans** : liste (table + filtres), drawer/page détail, changement de statut, archivage.
3. **UI** : table `mc-table`, barre de filtres (recherche + statut), badges de statut,
   drawer détail, dialogue de confirmation, état vide.
4. **Tables** : `requests` (existe). Aucune nouvelle.
5. **Relations** : → conversion en **Personne** (v1.5) / **Réservation** (v1.7) plus tard.
6. **Actions** : voir détail, changer statut, marquer traitée, archiver, (plus tard) convertir.
7. **États** : vide, loading, erreur (insert/maj), succès (toast).
8. **Dashboard** : KPI « Demandes en attente » + tuile « Demandes à traiter » (déjà réelles).
9. **Vigilance** : RLS — insert public anonyme OK, **pas de SELECT** anon (gotcha déjà géré).
10. **Version** : **v1.4** — sert de **modèle de portage** pour tous les modules suivants.

## v1.5 — Personnes
1. **Métier** : CRM du lieu — membres, contacts, intervenants, adhérents.
2. **Écrans** : liste/table, **vue cartes** (bascule), fiche détail, création/édition.
3. **UI** : avatar, chips/tags, table + cartes, view-toggle, drawer/modal d'édition.
4. **Tables** : `persons` (nom, email, tél, type, tags, notes, `organization_id`).
5. **Relations** : référencée par Demandes, Réservations, Événements, Résidences, Finances,
   Documents, Communication, Gouvernance, Partenaires. **Brique fondatrice.**
6. **Actions** : créer, éditer, taguer, archiver, rechercher/filtrer.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI « Membres actifs ».
9. **Vigilance** : dédoublonnage email ; lien optionnel vers `organization_members` (utilisateurs).
10. **Version** : **v1.5**.

## v1.6 — Espaces
1. **Métier** : catalogue des lieux louables/réservables (salles, ateliers, bureaux, extérieurs).
2. **Écrans** : grille de cartes (photo, capacité, tarif), fiche détail, création/édition.
3. **UI** : grille de cartes avec image, badges (type/disponibilité), formulaire.
4. **Tables** : `spaces` (nom, type, capacité, surface, tarif h/j, description, photos[], statut, org).
5. **Relations** : utilisé par Réservations, Résidences, Événements, Impact.
6. **Actions** : créer, éditer, publier/masquer, gérer photos.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI « Taux d'occupation » (croisé avec Réservations).
9. **Vigilance** : photos via **Supabase Storage** (bucket + policies) ; tarifs → Finances.
10. **Version** : **v1.6**.

## v1.7 — Réservations
1. **Métier** : gérer les réservations d'espaces (créneaux, statuts, conflits).
2. **Écrans** : **calendrier/semaine**, **kanban** (demande/confirmée/annulée), liste, détail.
3. **UI** : vue calendrier + semaine, kanban, badges de statut, drawer détail.
4. **Tables** : `reservations` (space_id, person_id, start_at, end_at, statut, prix, notes, org).
5. **Relations** : Espaces (lieu) + Personnes (réservant) ; → Finances (facturation).
6. **Actions** : créer, confirmer, annuler, déplacer, détecter les conflits de créneaux.
7. **États** : vide, loading, erreur (conflit/insert), succès.
8. **Dashboard** : tuile « Réservations du jour » + taux d'occupation.
9. **Vigilance** : **anti-chevauchement** (contrainte/validation serveur) ; fuseaux horaires.
10. **Version** : **v1.7**.

## v1.8 — Événements
1. **Métier** : programmer et publier des événements ; gérer les inscriptions.
2. **Écrans** : calendrier + cartes, fiche événement, table d'inscriptions, création/édition.
3. **UI** : cartes événement, calendrier (réutilisé), table inscriptions, badges visibilité.
4. **Tables** : `events` (titre, dates, space_id, capacité, statut, public, prix, org) +
   `event_registrations` (event_id, person_id, statut).
5. **Relations** : Espaces (lieu) + Personnes (organisateurs/inscrits) ; → Site public (publication).
6. **Actions** : créer, publier/dépublier, gérer capacité, inscrire/désinscrire.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI « Événements à venir » + tuile « Événements cette semaine ».
9. **Vigilance** : capacité vs inscriptions ; cohérence avec la vitrine publique.
10. **Version** : **v1.8**.

## v1.9 — Résidences
1. **Métier** : accueil de résidents/artistes (séjours longs, accompagnement).
2. **Écrans** : liste/timeline des résidences, fiche (étapes, espaces, dates), création/édition.
3. **UI** : cartes/timeline, badges statut, drawer détail, jalons.
4. **Tables** : `residencies` (titre, person_id, space_id, dates, discipline, montant, statut, org)
   (+ `residency_milestones` optionnel).
5. **Relations** : Espaces + Personnes ; → Documents (convention), Finances (bourse).
6. **Actions** : créer, planifier, suivre les étapes, clôturer.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI « Résidences en cours ».
9. **Vigilance** : chevauchement d'occupation d'espace avec Réservations/Événements.
10. **Version** : **v1.9**.

## v1.10 — Documents
1. **Métier** : GED du lieu — conventions, comptes rendus, statuts, pièces à signer.
2. **Écrans** : liste/table (type, statut), upload, prévisualisation, détail.
3. **UI** : **upload fichier**, ligne-fichier, badges statut (brouillon/à signer/signé), visionneuse.
4. **Tables** : `documents` (titre, type, file_path Storage, person_id?, related_type/id, statut, org).
5. **Relations** : Personnes (signataires) ; Finances (factures) ; Résidences (conventions).
6. **Actions** : déposer, classer, marquer à signer/signé, télécharger, archiver.
7. **États** : vide, loading (upload), erreur (upload/policy), succès.
8. **Dashboard** : tuile « Documents à signer ».
9. **Vigilance** : **Supabase Storage** (bucket privé + RLS) ; jamais d'URL publique non maîtrisée.
10. **Version** : **v1.10**.

## v1.11 — Finances
1. **Métier** : suivi des recettes/dépenses, facturation, trésorerie.
2. **Écrans** : tableau de bord financier (graphiques), liste transactions, factures, détail.
3. **UI** : **graphiques barres**, format monétaire, tables, badges (payé/impayé), formulaire.
4. **Tables** : `transactions` (type, montant, date, catégorie, person_id?, statut, org) +
   `invoices` (numéro, person_id, lignes, montant, échéance, statut, org).
5. **Relations** : Personnes (payeurs) ; Réservations/Résidences/Événements (à facturer) ;
   Documents (PDF facture).
6. **Actions** : saisir transaction, créer/émettre facture, marquer payé, relancer impayés.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI « Revenus du mois » + « Trésorerie estimée » + tuile « Impayés ».
9. **Vigilance** : exactitude des montants (entiers en centimes) ; numérotation de factures.
10. **Version** : **v1.11**.

## v1.12 — Médiathèque
1. **Métier** : bibliothèque d'images/vidéos/docs réutilisables (vitrine, comm, événements).
2. **Écrans** : grille média, upload multiple, détail/édition (alt, tags), lightbox.
3. **UI** : **grille média**, lightbox, upload, chips/tags.
4. **Tables** : `media_assets` (file_path Storage, type, titre, alt, tags, org).
5. **Relations** : alimente Site public, Communication, Événements.
6. **Actions** : importer, taguer, remplacer, supprimer, sélectionner.
7. **États** : vide, loading (upload), erreur, succès.
8. **Dashboard** : (optionnel) compteur de médias.
9. **Vigilance** : **Storage** + miniatures/poids ; droits d'usage des images.
10. **Version** : **v1.12** (avant Site public & Communication qui en dépendent).

## v1.13 — Site public (Vitrine)
1. **Métier** : éditer le site public du lieu (déjà servi sur `/site/[slug]` → `/[slug]` en prod).
2. **Écrans** : éditeur de sections/blocs, aperçu, réglages SEO, publication.
3. **UI** : éditeur par blocs, bascule brouillon/publié, aperçu, formulaires.
4. **Tables** : `public_sites` (existe, à étendre) + `site_sections`/`site_blocks` (ou contenu JSON).
5. **Relations** : expose Espaces, Événements, Médiathèque ; reçoit les **Demandes** (formulaire public).
6. **Actions** : éditer contenu, ordonner blocs, publier/dépublier, prévisualiser.
7. **États** : vide (site neuf), loading, erreur, succès.
8. **Dashboard** : statut du site (publié/brouillon).
9. **Vigilance** : **lecture publique** via policies dédiées ; ne jamais coder en dur `/site/...`
   côté produit (viser `/[slug]` via la réécriture `proxy.ts`).
10. **Version** : **v1.13**.

## v1.14 — Communication
1. **Métier** : campagnes/newsletters et messages vers la communauté.
2. **Écrans** : liste des campagnes, éditeur, sélection d'audience, historique d'envoi.
3. **UI** : éditeur de contenu, sélecteur d'audience (filtre Personnes), badges statut.
4. **Tables** : `campaigns` (sujet, corps, audience, statut, sent_at, org) (+ consentement sur `persons`).
5. **Relations** : Personnes (destinataires), Médiathèque (visuels).
6. **Actions** : rédiger, cibler, planifier, envoyer (intégration e-mail à cadrer), archiver.
7. **États** : vide, loading, erreur (envoi), succès.
8. **Dashboard** : (optionnel) dernière campagne / taux.
9. **Vigilance** : **consentement/RGPD** ; l'envoi e-mail réel nécessite un service serveur (hors front).
10. **Version** : **v1.14**.

## v1.15 — Gouvernance
1. **Métier** : vie associative — instances, réunions, décisions, mandats.
2. **Écrans** : calendrier/liste des réunions, fiche réunion (ordre du jour, CR, décisions), mandats.
3. **UI** : listes, badges, formulaires, table de décisions, timeline.
4. **Tables** : `meetings` (date, type CA/AG/bureau, ordre_du_jour, cr, org) +
   `decisions` (meeting_id, libellé, statut) + `mandates` (person_id, rôle, dates).
5. **Relations** : Personnes (membres/élus) ; réutilise `organization_members` (rôles).
6. **Actions** : planifier réunion, saisir CR, enregistrer décisions, gérer mandats.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : (optionnel) prochaine réunion.
9. **Vigilance** : confidentialité des CR ; cohérence rôles ↔ `organization_members`.
10. **Version** : **v1.15**.

## v1.16 — Partenaires
1. **Métier** : annuaire des partenaires (publics, privés, associatifs) et conventions.
2. **Écrans** : liste/cartes, fiche partenaire, conventions liées.
3. **UI** : cartes/table, badges type, chips, drawer détail.
4. **Tables** : `partners` (nom, type, contact person_id?, statut, notes, org) (+ lien Documents).
5. **Relations** : Personnes (interlocuteurs), Documents (conventions), Finances (subventions).
6. **Actions** : créer, qualifier, lier convention, archiver.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : (optionnel) partenaires actifs.
9. **Vigilance** : éviter le doublon avec Personnes (partenaire = organisation, pas individu).
10. **Version** : **v1.16**.

## v1.17 — Tâches & alertes
1. **Métier** : to-do transverse + alertes (échéances, impayés, signatures…).
2. **Écrans** : liste/kanban des tâches, alertes agrégées, détail.
3. **UI** : kanban (réutilisé), badges priorité, cases à cocher, filtres.
4. **Tables** : `tasks` (titre, due_at, assignee, priorité, statut, related_type/id, org).
5. **Relations** : peut référencer n'importe quelle entité (Demandes, Finances, Documents…).
6. **Actions** : créer, assigner, échéancer, cocher, filtrer.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : KPI/tuile « Tâches urgentes » + alertes.
9. **Vigilance** : ne pas dupliquer les statuts métiers ; les alertes peuvent être **calculées**.
10. **Version** : **v1.17**.

## v1.18 — Paramètres
1. **Métier** : configuration de l'organisation, équipe, rôles, image de marque.
2. **Écrans** : profil de l'org, membres & rôles, préférences, (slug/domaine).
3. **UI** : formulaires, table membres, toggles, sélecteurs de rôle.
4. **Tables** : `organizations` (étendre : branding/contact) + `organization_members` (rôles) +
   `org_settings` (JSON) optionnel.
5. **Relations** : transverse (rôles utilisés par toute la RLS).
6. **Actions** : éditer profil, inviter/retirer membre, changer rôle, régler préférences.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : —
9. **Vigilance** : **droits** (seul admin gère les membres) ; jamais de `service_role` côté front.
10. **Version** : **v1.18** (une version minimale de gestion d'équipe pourrait être avancée si besoin).

## v1.19 — Impact
1. **Métier** : mesurer l'impact (fréquentation, occupation, diversité, indicateurs subventions).
2. **Écrans** : tableaux de bord d'indicateurs, graphiques, export.
3. **UI** : graphiques (réutilisés), cartes d'indicateurs, filtres de période.
4. **Tables** : `impact_indicators` (clé, libellé, valeur, période, org) + **vues d'agrégation**
   (lecture des autres tables).
5. **Relations** : **agrège** Réservations, Événements, Personnes, Espaces, Finances.
6. **Actions** : consulter, filtrer par période, saisir indicateurs manuels, exporter.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : indicateurs clés synthétisés.
9. **Vigilance** : performance des agrégations (vues/`rpc`) ; à faire **après** les modules sources.
10. **Version** : **v1.19** (avant-dernier).

## v1.20 — Automatisations
1. **Métier** : règles « si … alors … » (relances impayés, confirmations, rappels d'événements).
2. **Écrans** : liste des règles, éditeur de règle, journal d'exécution.
3. **UI** : éditeur de règles (déclencheur/condition/action), toggles, table de logs.
4. **Tables** : `automations` (déclencheur, condition, action, actif, org) + `automation_runs` (log).
5. **Relations** : **agit sur** tous les modules (Demandes, Réservations, Finances, Comm…).
6. **Actions** : créer/activer une règle, tester, consulter l'historique.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : (optionnel) automatisations actives.
9. **Vigilance** : exécution réelle = **logique serveur** (jamais `service_role` côté front) ; à faire **en dernier**.
10. **Version** : **v1.20**.

## v1.21 — Dashboard (consolidation)
1. **Métier** : finaliser le cockpit avec **uniquement** des données réelles, retirer l'illustratif.
2. **Écrans** : vue d'ensemble enrichie (KPI réels, « Aujourd'hui » réel, actions prioritaires).
3. **UI** : composants existants ; logique « actions prioritaires » du prototype.
4. **Tables** : aucune nouvelle (lit tout).
5. **Relations** : tous les modules.
6. **Actions** : navigation, raccourcis, actions rapides réellement branchées.
7. **États** : vide, loading, erreur, succès.
8. **Dashboard** : c'est le module lui-même.
9. **Vigilance** : ne lancer qu'une fois assez de modules livrés pour que le cockpit soit pertinent.
10. **Version** : **v1.21** (finalisation, optionnelle/glissante).

---

## Ce qui démarre après validation

1. Validation visuelle du **shell v1.3.1** (hard-refresh navigateur).
2. Validation de **ce plan** (ordre, versions, périmètres).
3. Puis **v1.4 — Demandes fidèle Claude Design + Supabase**, qui sert de patron de portage
   (table + filtres + drawer + confirm + états) réutilisé par tous les modules suivants.
