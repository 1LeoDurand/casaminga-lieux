# VERSIONS — Casa Minga Lieux
> Référence développeur : état de chaque version, notes de reprise, prochaines étapes.
> Fichier à lire en premier quand on reprend le projet.

---

## ✅ Versions réalisées

### v1.0 — Socle technique
**Tag** `v1.0-socle` · **Commit** `77fc3d4`

Fondation complète : design system CSS (`globals.css`, tokens `@theme inline`), App Router Next.js,
clients Supabase (`src/lib/supabase/`), migration 0001 (organizations, profiles, members,
public_sites, requests + RLS + helper `is_org_member`), seed Bernard Kohn, proxy host
(`src/proxy.ts` : apex → `/site/[slug]`), layout dashboard (sidebar + topbar).

> **Note dev** : tout le design system est dans `globals.css`. Tailwind v4 = pas de config file,
> uniquement `@theme inline`. Ne pas toucher shadcn/ui sauf pour les primitives de base.

---

### v1.1 — Premier flux end-to-end
**Tag** `v1.1-demandes` · **Commit** `7162543`

Formulaire public (`/site/[slug]`) → POST `/api/orgs/[slug]/requests` → table `requests` →
dashboard Demandes. Mode démo (globalThis store) + Supabase réel selon env.

> **Note dev** : la route API ne fait pas de `.select()` après insert (pas de policy SELECT pour
> l'anon). L'id est généré côté serveur avec `crypto.randomUUID()`. Pattern à réutiliser pour
> toute insertion publique anonyme.

---

### v1.2 — Supabase réel branché
**Tag** `v1.2-supabase-demandes` · **Commit** `72e06a4`

Connexion Supabase effective (`.env.local` renseigné), auth réelle (`/login`), RLS validée.
`isSupabaseConfigured()` dans `src/lib/supabase/env.ts` = le switch démo ⇆ réel.

> **Note dev** : RLS membre-only = liste vide en curl/non-authentifié = comportement CORRECT.
> Ne jamais "fixer" ça. Les données s'affichent une fois connecté comme membre de l'org.

---

### v1.3 — UI kit + shell dashboard fidèle
**Tag** `v1.3-ui-kit-shell` · **Commit** `968da11`

Portage fidèle de l'interface Claude Design. Sidebar groupée (Pilotage / Gestion du lieu /
Structure / Publication / Système), topbar, cockpit KPIs + "Aujourd'hui" + "Demandes récentes".
Toutes les primitives `mc-*` de base dans `globals.css`.

> **Note dev** : couche purement visuelle, rien de cassé côté Supabase. Les modules non construits
> envoient un toast "à venir" (pas de lien mort). `src/lib/modules.ts` = la liste des 18 modules
> avec `ready: boolean`.

---

### v1.4 — Module Demandes complet
**Tag** `v1.4-demandes` · **Commit** `3356b68`

**Modèle de portage** pour tous les modules suivants. Vue `requests-view.tsx` : 5 KPIs,
toolbar (recherche + CSV), filtres chips, table → drawer détail, confirm avant archivage.
Primitives ajoutées : `mc-table`, `mc-chip`, `mc-drawer`, `mc-confirm`, `mc-empty`, `mc-skeleton`.

> **Note dev** : ce composant est le template de référence. Chaque nouveau module copie ce pattern :
> KPIs → toolbar → filtres → liste/cartes → drawer → modal form → confirm delete.

---

### v1.5 — Module Personnes (CRM)
**Tag** `v1.5-personnes` · **Commit** `72459c1`

Table `persons` (migration 0002). Vue `persons-view.tsx` : bascule cartes ⇆ tableau, avatars
à initiales + couleur déterministe, filtres rôle/statut, drawer, modal form (`person-form.tsx`).
KPI cockpit « Membres actifs » câblé sur données réelles.

> **Note dev** : les avatars ont une couleur déterministe (hash du nom → index couleur). Le form
> garde des **string values** pour les champs numériques — la conversion se fait dans `submitForm`
> de la vue parente. Pattern **impératif** pour tous les formulaires suivants.
> La `key` sur `<PersonForm>` garantit un état frais (pas d'effet reset).

---

### v1.6 — Module Espaces (catalogue)
**Tag** `v1.6-espaces` · **Commit** `fed88f1`

Table `spaces` (migration 0003). Vue `spaces-view.tsx` : cartes à photo (ou dégradé à initiales),
types (salle/atelier/bureau/extérieur/commun), statuts (disponible/maintenance/masqué), tarifs h/j.
KPI cockpit « Espaces au catalogue » câblé.

> **Note dev** : `spaceInitials(name)` pour le placeholder photo. `priceSummary(hour, day)` pour
> l'affichage tarifaire court. Primitives photo : `mc-space-cover` + `mc-space-cover-ph`.
> Photos = URLs pour l'instant (Supabase Storage prévu plus tard).

---

### v1.7 — Module Réservations (planning)
**Tag** `v1.7-reservations` · **Commit** `e4ccdf3`

Table `reservations` (migration 0004, FK spaces + persons). Vue `reservations-view.tsx` :
3 vues (kanban par statut / agenda par jour / tableau), anti-chevauchement double garde.

> **Note dev** : l'anti-chevauchement est géré à **deux niveaux** :
> 1. Pre-check applicatif dans `data.ts` (pour le mode démo ET pour afficher un message clair)
> 2. Contrainte SQL `EXCLUDE USING gist(space_id WITH =, tstzrange(start_at, end_at) WITH &&)`
>    — nécessite l'extension `btree_gist` (incluse dans Supabase).
> Le retour est `{ ok: boolean; conflict?: boolean }` — distingue chevauchement d'erreur générique.
> La table `evenements` existe déjà en Supabase (créée manuellement, 0 lignes) → à inspecter en v1.8.

---

## ✅ Suite des versions réalisées (v1.8 → v1.15)

### v1.8 — Module Événements ✅
**Commit** `b8f6ac2` · **Tag** `v1.8-evenements`

Table `evenements` (ALTER depuis la table existante + enrichissement : organization_id, type, status, space_id, start_at, end_at, capacity, price, photos, updated_at). Vue `events-view.tsx` : 3 vues cartes/agenda/table, KPIs (total, à venir, publiés, cette semaine, annulés), filtres type/statut, actions rapides publier/dépublier. KPI cockpit « Événements à venir » câblé réel.

> **Note dev** : `evenements` (table Supabase préexistante) est enrichie via ALTER TABLE — pas recréée. `space_id` nullable. `events-meta.ts` : formatters date/heure, `isFuture`, `isThisWeek`.

---

### v1.9 — Module Résidences ✅
**Commit** `e4d8367` · **Tag** `v1.9-residences`

Table `residences` (FK spaces + persons, disciplines, statuts workflow). Vue `residences-view.tsx` : tableau + filtres discipline/statut, workflow Candidature→Acceptée→En cours→Terminée/Refusée avec actions rapides dans le drawer.

---

### v1.10 — Module Documents ✅
**Commit** `dd65739` · **Tag** `v1.10-documents`

Table `documents` (type contrat/devis/facture/convention/rapport, URL externe). Vue `documents-view.tsx` : tableau filtrable, workflow Brouillon→Envoyé→Signé→Archivé, lien fichier externe, lien personne.

> **Note dev** : upload réel via Supabase Storage à brancher en v2. Pour l'instant = URL libre.

---

### v1.11 — Module Finances ✅
**Commit** `01b27df` · **Tag** `v1.11-finances`

Table `transactions` (recettes/dépenses, catégories). Vue `finances-view.tsx` : solde net en temps réel, **graphique barres CSS sans lib externe**, tableau filtrable, KPI cockpit « Solde net » câblé réel.

> **Note dev** : graphique = `BarChart` component CSS pur dans `finances-view.tsx`, pas de recharts. Colonne `amount` est `numeric(10,2)` côté Supabase → toujours `Number(t.amount)` en TypeScript.

---

### v1.12 — Médiathèque ✅ | v1.13 — Site public ✅ | v1.14 — Communication ✅ | v1.15 — Paramètres ✅
**Commit** `0ce52f8` · **Tag** `v1.12-v1.15-publication`

- **Médiathèque** : table `media`, galerie cartes à miniature, filtres type/tags, drawer aperçu + lien externe.
- **Site public** : tableau de bord des données publiées (espaces disponibles, événements publiés), lien « Voir le site ».
- **Communication** : table `announcements`, liste d'annonces, filtres statut, workflow brouillon→publié→archivé, audience membres/public/tous.
- **Paramètres** : fiche organisation en lecture (nom, slug, structure, horaires, couleur, plan) — édition prévue en v2.

---

## ✅ Série v2 — modules transverses (TOUS livrés)

> Chaque version v2 : migration via **MCP Supabase** → seed → **audit `get_advisors` (security)** →
> code → lint/build → check route → commit → tag → archive. Audit de chaque table : RLS + policy
> présentes, aucun nouveau risque (warnings restants = helpers `security_definer` voulus + config auth).

### v2.0 — Tâches & alertes ✅
**Commit** `9583ead` · **Tag** `v2.0-taches`
Table `tasks`. Kanban à faire/en cours/fait, priorités, échéances, alerte de retard calculée
(`isOverdue`), assignation aux personnes. KPI cockpit « Tâches urgentes » câblé (haute priorité OU en retard).

### v2.1 — Communauté ✅
**Commit** `ff7b42d` · **Tag** `v2.1-communaute`
Table `community_posts`. Fil d'entraide entre membres : offre/demande/entraide/info, workflow
actif→résolu→archivé, auteur lié aux personnes.

### v2.2 — Gouvernance ✅
**Commit** `13cfdae` · **Tag** `v2.2-gouvernance`
Tables `meetings` + `mandates`. Onglets Réunions (CA/AG/bureau, ordre du jour, CR, marquer tenue)
et Mandats (rôle, personne, période, actif/terminé).

### v2.3 — Partenaires ✅
**Commit** `90eedbc` · **Tag** `v2.3-partenaires`
Table `partners`. Annuaire à cartes : type public/privé/associatif/fondation, contact lié,
email/téléphone/site web cliquables.

### v2.4 — Impact ✅
**Commit** `dd63079` · **Tag** `v2.4-impact`
Table `impact_indicators` + **agrégats automatiques temps réel** (réservations, événements,
personnes, espaces, solde net finances) calculés côté serveur, + indicateurs manuels CRUD.

> **Note dev** : la page Impact agrège les données réelles des autres modules dans `page.tsx`
> (serveur) et passe `AutoStats` à la vue. Les indicateurs manuels sont en base.

### v2.5 — Automatisations ✅
**Commit** `b66089f` · **Tag** `v2.5-automatisations`
Table `automations`. Règles « si… alors… » (déclencheur/condition/action), toggle actif,
compteur d'exécutions. **L'exécution réelle relève de la logique serveur** — aucun secret côté front.

### v2.6 — Adhésions dédié (façon HelloAsso) ✅
**Tag** `v2.6-adhesions`
Module d'adhésions complet, **double face** :
- **Back-office** (`/dashboard/[org]/adhesions`) : liste « Mes campagnes » (KPIs campagnes /
  publiques / adhérents confirmés / collecté), wizard 3 étapes (Infos générales : titre, slug,
  statut, période `année glissante`/`illimitée`/`personnalisée` → Montants & paramètres :
  formules, don optionnel, nb max, options cartes/compteur → Résumé), et drawer
  « Administrer » (souscriptions, confirmer/annuler, dates de validité calculées).
- **Tunnel public** (`/site/[slug]/adhesion/[campaignSlug]`) : parcours 4 étapes sans login
  (Formule + don → Adhérent → Coordonnées payeur → Récapitulatif), embarquable sur le site de
  chaque association. Les campagnes publiées apparaissent dans la section « Adhérer » de
  `/site/[slug]`.

3 tables : `membership_campaigns`, `membership_tiers`, `membership_applications`.
Soumission via `POST /api/orgs/[slug]/adhesions/[campaignSlug]` (insert anon, **sans `.select()`**,
status `en_attente`), autorisée par la policy RLS `ma_public_insert` (campagne `publie`).

> **Note dev** : statut publié = `'publie'` **partout** (app + DB). D'anciennes policies en double
> (`campaigns_/tiers_/applications_public_*` sur `'public'`) ont été supprimées ; seules les
> `mc_/mt_/ma_public_*` (sur `'publie'`) subsistent. Dates de validité calculées par
> `computeMembershipEnd` (`adhesions-meta.ts`) : année glissante = +1 an. Vérifié end-to-end
> (POST 201, ligne en base correcte, brouillon → 404).

---

## 🎉 État : les 19 modules sont `ready`

Toute la navigation est en ligne. `src/lib/modules.ts` ne contient plus aucun `ready: false`.
Build complet vert (19 routes `/dashboard/[org]/*`), lint 100% clean.

### Pistes d'amélioration futures (non bloquantes)
- **Upload réel** Supabase Storage pour Documents & Médiathèque (actuellement = URL libre).
- **Site public enrichi** côté visiteur : sections espaces + événements sur `/site/[slug]`.
- **Paramètres** : édition de la fiche organisation (actuellement lecture seule).
- **Exécution réelle** des automatisations via Edge Functions Supabase.
- Avertissements `get_advisors` cosmétiques : `search_path` sur `set_updated_at`, `btree_gist`
  en schéma public, activation « leaked password protection » dans Auth.

---

## Conventions rappel rapide

```
Bash CWD reset → toujours cd "D:/0 - Sync cloud Kdrive/01 Casaminga/01 Dev/casa-minga-lieux"
Workflow : lint → build → présenter → valider → commit → tag → archive
Archive : git archive --format=zip --prefix=casa-minga-lieux-<tag>/ -o "D:/0 - Sync cloud Kdrive/01 Casaminga/01 Dev/archives/casa-minga-lieux-<tag>.zip" <tag>
Jamais : service_role key côté front · .env.local commité · git add -A
MCP Supabase : connecté → project_id = gzijdwrzcuokvfkpcczr
```
