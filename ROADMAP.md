# Roadmap — Casa Minga Lieux

## Point de vigilance — route publique

⚠️ **La route publique locale n'est pas la cible produit.**

- **Local (dev)** : le site public est servi sur `/site/[slug]`, ex. `/site/bernard-kohn`.
  C'est un **alias pratique** pour développer sans configuration de hosts.
- **Cible produit** : `casaminga.com/[organizationSlug]`, ex. `casaminga.com/bernard-kohn`
  (slug à la racine du host public, **sans** préfixe `/site`).

Le pont entre les deux est déjà en place dans [`src/proxy.ts`](src/proxy.ts) : sur l'apex
`casaminga.com`, `/<slug>` est réécrit vers `/site/<slug>`. L'architecture doit donc **toujours**
garder `/site/[slug]` comme implémentation interne, et `/[slug]` comme URL publique finale via la
réécriture. Ne pas coder de lien public en dur vers `/site/...` côté produit : viser `/[slug]`.

À valider plus tard : déploiement multi-domaines (`admin.casaminga.com` + `casaminga.com`),
configuration des hosts/Vercel, et tests de la réécriture en conditions réelles.

---

## Versions

### v1 — socle technique ✅
Design system, routes de base, clients Supabase, migration + seed, dashboard + site public minimaux.

### v1.1 — premier flux end-to-end ✅
Site public → formulaire → création d'une demande → affichage dans le dashboard.
- Formulaire public (`/site/bernard-kohn`) : nom, email, téléphone, structure, type, message.
- Route serveur `POST /api/orgs/[slug]/requests` : résout l'org, insère dans `requests`
  (Supabase si configuré, fallback démo sinon), jamais de clé `service_role` côté client.
- Page Demandes (`/dashboard/bernard-kohn/demandes`) : liste, détail, changement de statut,
  marquer traitée, archiver, toasts.

### v1.2 — flux Demandes sur Supabase réel ✅
Le même flux tourne sur la vraie table `requests` (plus de fallback démo une fois `.env.local` renseigné).
- Migration `0001_init_socle.sql` + `seed.sql` appliqués via SQL Editor ; `verify.sql` (lecture seule).
- Auth réelle (`/login`) + appartenance `organization_members` (rôle `admin`) → lecture dashboard filtrée par RLS (`is_org_member`).
- Insertion publique anonyme via la policy `requests_insert_from_public_site` ; `id` généré côté serveur,
  pas de `.select()` de retour (aucune policy SELECT pour l'anonyme). Aucune clé `service_role` côté front.

### v1.3 — UI kit + shell dashboard fidèle ✅
Réorientation : porter beaucoup plus fidèlement l'interface Claude Design officielle sur
`admin.casaminga.com`, sans casser la fondation Next.js/Supabase. **Couche purement visuelle** —
aucune modification du socle Supabase/auth/RLS : le flux Demandes v1.2 reste intact.
- **UI kit fidèle** (`src/app/globals.css`, classes `mc-*` portées de `Plateforme.html`) :
  page-header (`mc-page-tag/title/sub`), badges (`mc-badge-*`), boutons (`mc-btn-*`),
  tuiles KPI (`mc-kpi-tile`), grille « Aujourd'hui » (`mc-today-it`), cartes dashboard
  (`mc-dash-*`), nav latérale (`mc-nav-item/badge`). Composants : `page-header`, `mc-badge`,
  `kpi-tile`, `dashboard-quickbar`, `dashboard-today`.
- **Shell dashboard fidèle** : sidebar avec groupement officiel **Pilotage · Gestion du lieu ·
  Structure · Publication · Système**, pastille **DÉMO**, sous-titre `Casa Minga Lieux · /<slug>`,
  badge Demandes branché sur le **vrai** nombre de demandes ouvertes ; topbar avec titre de page
  dérivé de l'URL, recherche, « Voir le site public », « Landing », cloche de notifications.
- **Vue d'ensemble fidèle** (cockpit) : en-tête + barre d'actions rapides, rangée de 6 tuiles KPI
  (illustratives en mode démo, sauf « Demandes » = données réelles), grille « Aujourd'hui »,
  carte « Demandes récentes » (données réelles). Les modules non encore construits annoncent
  leur arrivée via toast (pas de lien mort).

### v1.4 — module Demandes fidèle (UI Claude Design + Supabase) ✅
Premier module reconstruit selon le plan ([`docs/PLAN_RECONSTRUCTION.md`](docs/PLAN_RECONSTRUCTION.md)) ;
sert de **modèle de portage** pour tous les modules suivants. **Couche visuelle + UI** — la table
`requests` (v1.2) et la RLS restent intactes.
- **Primitives `mc-*` réutilisables** ajoutées à `globals.css` : `mc-kpi-grid`/`mc-stat`
  (stat-cards), `mc-input`/`mc-search`, `mc-chip`/`mc-filter-row` (filtres), `mc-table`,
  `mc-empty`, `mc-skeleton`, `mc-drawer`, `mc-confirm`.
- **Écran Demandes** (`requests-view.tsx`) : en-tête fidèle (`PageHeader`), **5 KPIs réels**
  (ouvertes, urgentes, cette semaine, en attente, traitées), toolbar (recherche live + export
  CSV + reset), **filtres à chips** (type/statut/priorité), **table** clic → **drawer détail**
  (contact, message, changement de statut, marquer traitée), **dialogue de confirmation**
  (`confirm-dialog.tsx`) avant archivage.
- **4 états couverts** : vide (`mc-empty`), loading (`loading.tsx` skeleton), erreur
  (`error.tsx`, frontière + Réessayer), succès (toasts `sonner`).
- **Supabase** : aucune nouvelle table ; lecture par RLS (`getRequestsForOrg`), maj de statut
  via server action ; jamais de `service_role` côté front. `requests-board.tsx` supprimé (remplacé).

### v1.5 — module Personnes (CRM du lieu) ✅
Deuxième module reconstruit selon le modèle de portage. **Nouvelle table métier + UI fidèle.**
- **Migration `0002_personnes.sql`** (idempotente) : table `persons` (`organization_id` FK,
  `name`, `email`, `phone`, `role`, `status`, `tags text[]`, `notes`, timestamps), index
  `(org, status)` et `(org, role)`, trigger `set_updated_at`, **RLS membre-only**
  (`persons_member_all` via `is_org_member`). Seed : 6 personnes de démo (`on conflict do nothing`).
- **Primitives `mc-*`** ajoutées à `globals.css` : `mc-view-toggle`/`mc-view-btn`, `mc-avatar`,
  `mc-tag`, `mc-cards-grid`/`mc-person-card`, `mc-modal`/`mc-modal-ov`, `mc-form-group`/`mc-textarea`.
- **Écran Personnes** (`persons-view.tsx`) : `PageHeader` fidèle, **5 KPIs réels** (actives,
  coworkers, bénévoles, intervenant·es, prospects), toolbar (recherche + **bascule cartes ⇆
  tableau** + Ajouter + reset), **filtres à chips** (rôle/statut), **grille de cartes** à avatars
  (initiales + couleur déterministe) **ou** vue tableau, clic → **drawer détail** (contact, tags,
  notes, Modifier/Supprimer), **formulaire modal** création/édition (`person-form.tsx`),
  **confirmation** avant suppression. KPI « Membres actifs » du cockpit câblé sur le décompte réel.
- **4 états couverts** : vide (`mc-empty`), loading (`loading.tsx`), erreur (`error.tsx`),
  succès (toasts `sonner`).
- **Supabase** : `getPersonsForOrg` / `createPerson` / `updatePerson` / `deletePerson` (demo ⇆
  Supabase), server actions avec `revalidatePath` ; jamais de `service_role` côté front.

### Prochaines versions (ordre MVP)
Espaces → Réservations → Résidences → Événements → modules Structure / Publication /
Système. Chaque module = **une version**, livré avec UI fidèle **et** liaison Supabase ensemble.
Chaque table métier reste liée à `organization_id` avec RLS. Détail dans
[`docs/PLAN_RECONSTRUCTION.md`](docs/PLAN_RECONSTRUCTION.md).

### Règle de versioning (STRICTE)

> **Avant chaque nouvelle version, créer un commit, un tag et une copie complète du dossier précédent.**

Procédure obligatoire, dans l'ordre, **avant** de commencer la version suivante :

1. **Vérifier le build** : `npm run build` doit passer.
2. **Commit Git propre** : arbre de travail clean, message clair (`vX.Y - description`).
3. **Tag Git de version** : ex. `v1.0-socle`, `v1.1-demandes`.
4. **Archive depuis le tag** (jamais une copie du dossier de travail, qui peut contenir
   du WIP de la version suivante). Générer un ZIP figé sur l'arbre du tag :

   ```powershell
   git archive --format=zip --prefix=casa-minga-lieux-<tag>/ `
     -o "D:\01 Casaminga\01 Dev\archives\casa-minga-lieux-<tag>.zip" <tag>
   ```

   Ex. `git archive ... casa-minga-lieux-v1.1-demandes.zip ... v1.1-demandes`.
   `git archive` n'inclut que les fichiers **suivis du commit taggé** : les fichiers
   ignorés (`.env.local`, `node_modules`, `.next`) et le WIP non commité sont exclus
   par construction. Vérifier ensuite que l'archive correspond bien au tag (et non au WIP).
5. **Seulement ensuite**, démarrer le développement de la version suivante.

Convention de nommage :

| Élément              | Exemple                                                    |
| -------------------- | ---------------------------------------------------------- |
| Développement actif  | `casa-minga-lieux`                                         |
| Archive (depuis tag) | `archives\casa-minga-lieux-v1.1-demandes.zip` (tag `v1.1-demandes`) |

Historique des versions :

| Version | Tag             | Commit    | Archive (figée sur le tag)                       |
| ------- | --------------- | --------- | ------------------------------------------------ |
| v1.0    | `v1.0-socle`            | `77fc3d4` | incluse dans l'historique Git / push GitHub              |
| v1.1    | `v1.1-demandes`         | `7162543` | `archives\casa-minga-lieux-v1.1-demandes.zip`            |
| v1.2    | `v1.2-supabase-demandes`| `72e06a4` | `archives\casa-minga-lieux-v1.2-supabase-demandes.zip`   |
| v1.3    | `v1.3-ui-kit-shell`     | `968da11` | `archives\casa-minga-lieux-v1.3-ui-kit-shell.zip`        |
| v1.4    | `v1.4-demandes`         | `3356b68` | `archives\casa-minga-lieux-v1.4-demandes.zip`            |
| v1.5    | `v1.5-personnes`        | `72459c1` | `archives\casa-minga-lieux-v1.5-personnes.zip`          |
