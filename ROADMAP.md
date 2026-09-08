# Roadmap — Casa Minga Lieux

## Point de vigilance — route publique

⚠️ **La route publique locale n'est pas la cible produit.**

- **Local (dev)** : le site public est servi sur `/site/[slug]`, ex. `/site/demo-tiers-lieu` (org démo locale).
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

## Backlog — planifié, non construit

Items isolés (spec courte autonome, un item à la fois). Statut : **À FAIRE**.

### [B1] Lien de paiement par carte sur les factures — statut À FAIRE

**Valeur** : encaisser une facture en un clic côté client, réduire les impayés (8 « à relancer »
aujourd'hui). **Effort** : S/M — l'infra de paiement existe déjà, rien à créer côté Stripe.

**Besoin (Léo)** : à l'émission d'une facture réglée « par carte », un lien de paiement part
**dans le même email** que la facture. Et dans la liste des factures, un bouton
**« Envoyer un lien de paiement »** par ligne.

**Socle déjà en place (à réutiliser tel quel)** :
- Stripe Connect par org (`organizations.stripe_account_id`, encaissement direct, 0 commission),
  vérif onboarding `accountChargesEnabled()` — [`src/lib/stripe.ts`](src/lib/stripe.ts).
- `createCheckoutSession()` déjà générique (montant + libellé + email + **métadonnées libres**).
- Webhook `checkout.session.completed` qui dispatche par métadonnée (don/adhésion/event/résa) —
  [`src/app/api/orgs/[slug]/stripe/webhook/route.ts`](src/app/api/orgs/[slug]/stripe/webhook/route.ts).
- Envoi email facture + PDF (`sendInvoiceEmail`, `tplFactureRappel`) et marquage payée → recette
  Finances auto (`setInvoiceStatus`, idempotent) — [`.../factures/actions.ts`](src/app/(admin)/dashboard/[org]/factures/actions.ts).

**Périmètre isolé (5 briques)** :
1. **Migration** sur `invoices` : `payment_link_url text`, `payment_link_session_id text`,
   `payment_link_status text` (`none`/`sent`/`paid`).
2. **Action** `createInvoicePaymentLink(orgId, orgSlug, invoiceId)` : gardes (facture émise +
   `client_email` + Stripe connecté & `charges_enabled`) → `createCheckoutSession` avec
   `metadata: { invoice_id }`, `amountEuros = total_ttc`, `label = "Facture <numéro>"` → stocke
   l'URL + session id, statut `sent`.
3. **Email** : `sendInvoiceEmail` accepte un `payUrl?` optionnel ; le template affiche un bouton
   « Payer en ligne par carte » sous le rappel IBAN.
4. **Déclencheurs** : (a) à l'émission, si `payment_method === "carte"` → créer le lien + envoyer
   automatiquement ; (b) bouton ligne « Envoyer un lien de paiement » dans la liste (désactivé +
   tooltip si Stripe non connecté).
5. **Webhook** : branche `invoice_id` → facture `payee`, `payment_method = "carte"`, `paid_at`,
   recette Finances (idempotent par `invoice_id`).

**Garde-fous** : Stripe non connecté → bouton off + lien Paramètres ; pas d'email client → blocage ;
montant ≤ 0 (avoirs) exclus ; idempotence webhook par `invoice_id`.

**Pré-requis Léo** : l'org doit avoir connecté Stripe (Paramètres → Stripe) ; variables plateforme
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` déjà requises.

---

### [B2] Interface de caisse type comptoir (POS) — statut À FAIRE

**Valeur** : rendre la caisse utilisable au comptoir d'une buvette par un bénévole, là où
l'écran actuel est un registre comptable pensé pour un trésorier. **Effort** : M/L.

**Constat (08/09/2026)** : `caisse/` propose quatre onglets (écritures, pointage, clôtures,
statistiques) et une saisie par formulaire dans un tiroir. Les raccourcis
([`CashShortcut`](src/lib/types.ts)) **pré-remplissent le formulaire** au lieu d'alimenter un
panier. Le manque réel n'est pas visuel : c'est **le panier**. Aujourd'hui un clic = un
encaissement = une écriture scellée.

**Contrainte structurante** — dans `cash_add_entry`, le ticket dérive de la séquence :

```sql
v_ticket := 'CM-' || to_char(p_occurred_at, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');
```

Deux écritures ne peuvent donc **jamais** partager un `ticket_ref`. Y toucher voudrait dire
modifier la chaîne de hachage, donc rompre la conformité NF525.

**Le point d'accroche** : `source_ref` est du texte libre et **exclu du payload de hash**. Il
peut porter la référence du ticket de caisse sans toucher à la partie certifiée.

**Architecture retenue** : le panier vit **hors** du registre — tables `cash_tickets`
(ouvert / en attente / encaissé) et `cash_ticket_lines`, sans contrainte NF525 puisque c'est du
détail commercial. À l'encaissement seulement, on écrit dans `cash_entries` **une écriture par
taux de TVA** (obligatoire pour la ventilation : bière à 20 % et sandwich à 10 % ne tiennent pas
dans la même ligne), toutes portant le même `source_ref = référence du ticket`.
`cash_add_entry` n'est pas modifiée.

**Découpage** :
1. **Catalogue et grille** — ajouter `category` et `color` à `CashShortcut` (déjà stocké en JSON,
   migration triviale) ; remplacer le tiroir par une grille de boutons colorés avec colonne de
   catégories. Donne ~70 % du résultat visuel sans toucher à la base certifiée.
2. **Le panier** — les deux tables, le ticket en cours, le total, les boutons Espèces / CB, la
   mise en attente.
3. **Le confort** — plan de salle, tarif sur place / à emporter, note de ticket. Seulement si
   l'usage le réclame.

**Pré-requis** : traiter [B3] d'abord.

---

### [B3] Doublon de `cash_add_entry` — l'annulation d'écriture est cassée — statut À FAIRE

**Valeur** : sur une caisse certifiée, l'annulation est le geste réglementaire prévu, puisqu'une
écriture scellée ne peut pas être modifiée. **Effort** : XS.

**Constat (07/09/2026)** : deux surcharges coexistent en production, l'une à 12 paramètres
(l'originale), l'autre à 14 (elle ajoute `p_person_id` et `p_establishment_id`). La migration qui
a introduit les deux nouveaux champs n'a pas supprimé l'ancienne fonction.

`addCashEntry` passe les deux paramètres distinctifs et désigne donc la bonne sans ambiguïté.
Mais **`voidCashEntry` n'en passe aucun** : ses onze arguments existent des deux côtés, les
manquants ont une valeur par défaut partout, et PostgREST refuse de trancher entre deux
candidates également valables.

Défaut **latent** : 4 écritures en base au 07/09, **0 annulation** — le chemin n'a jamais été
exercé. Le premier bénévole qui corrigera une saisie erronée obtiendra une erreur.

**Correctif** — sans effet sur les écritures existantes, le payload de hachage étant identique
entre les deux versions (ni pôle, ni personne, ni établissement n'y entrent) :

```sql
drop function public.cash_add_entry(
  uuid, text, numeric, numeric, text, text, text,
  text, boolean, bigint, timestamp with time zone, uuid
);
```

---

### [B4] Mise à jour Next.js 16.3.4 — sécurité — statut À FAIRE

**Valeur** : `next@16.2.6` porte un avis **« Middleware / Proxy bypass in App Router »**, plus
deux SSRF (Server Actions, rewrites). Sur une application multi-tenant où
[`src/proxy.ts`](src/proxy.ts) route par domaine, c'est le point sérieux.
**Effort** : S, mais impose un rebuild et un redéploiement.

`next@16.3.4` corrige **`next`, `sharp` et `postcss` d'un coup** — ces deux derniers sont
embarqués sous Next — et c'est une montée **mineure**, pas un changement majeur.

À part : `nodemailer` 8 → 10 est un saut **majeur**, donc vérification de l'API d'envoi avant.
Le reste des 15 avis (`hono`, `brace-expansion`, `js-yaml`…) est transitif et sans exposition
directe en production.

---

### [B5] Variables `NEXT_PUBLIC_` absentes du serveur — statut À FAIRE

**Valeur** : quatre variables utilisées par le code manquent dans `.env` **et** `.env.local` du
slot — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_CUSTOM_DOMAIN_TARGET_IP`. **Effort** : XS.

Chaque usage retombe sur une valeur par défaut, donc **rien ne plante** — la panne est
silencieuse. Conséquence visible : la page qui explique à un lieu comment brancher son domaine
personnalisé affiche une **IP vide**.

⚠️ Ces variables sont figées **au build** : les ajouter impose un rebuild, pas un simple
redémarrage.

---

### [B6] Dette de lint restante — statut À FAIRE

**Valeur** : rendre `npm run lint` utilisable comme étape CI bloquante. **Effort** : S.

Après le recentrage de `react/no-unescaped-entities` (commit `a7199df`), il reste **40 erreurs** :

| Règle | Nombre | Nature |
|---|---|---|
| `react-hooks/set-state-in-effect` | 15 | **Faux positifs** — pattern légitime « lire `localStorage` au montage » (bandeau cookies, GA, `dashboard-shell`) |
| `@next/next/no-html-link-for-pages` | 12 | Dont 2 volontaires (`/espace` : le rechargement vide le contexte du jeton magique) |
| `react-hooks/static-components` | 7 | 7 sur `mentions-legales` — page sans état, impact nul |
| `react-hooks/purity` | 5 | `Date.now()` pendant le rendu — risque d'écart d'hydratation |
| `react-hooks/refs` | 1 | `site-public-editor` : pattern « ref vers la valeur courante », toléré |

Aucune n'empêche de travailler. Décider règle par règle : corriger, ou désactiver avec
justification — puis rendre le lint bloquant.


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

### v1.6 — module Espaces (catalogue du lieu) ✅
Troisième module reconstruit selon le modèle de portage. **Nouvelle table métier + UI fidèle.**
- **Migration `0003_espaces.sql`** (idempotente) : table `spaces` (`organization_id` FK, `name`,
  `type`, `capacity`, `area`, `price_hour`, `price_day`, `description`, `photos text[]`, `status`,
  timestamps), index `(org, status)` et `(org, type)`, trigger `set_updated_at`, **RLS membre-only**
  (`spaces_member_all` via `is_org_member`). Seed : 5 espaces de démo (`on conflict do nothing`).
- **Primitives `mc-*`** ajoutées à `globals.css` : `mc-space-card`, `mc-space-cover`(+placeholder),
  `mc-space-badges`, `mc-space-body`, `mc-space-meta`/`mc-space-meta-item`, `mc-space-price`,
  `mc-space-hero`.
- **Écran Espaces** (`spaces-view.tsx`) : `PageHeader` fidèle, **5 KPIs réels** (espaces,
  disponibles, capacité totale, surface m², en maintenance), toolbar (recherche + **bascule cartes
  ⇆ tableau** + Ajouter + reset), **filtres à chips** (type/statut), **grille de cartes** à
  couverture photo (ou dégradé à initiales, badges superposés) **ou** vue tableau, clic → **drawer
  détail** (hero photo, capacité/surface/tarifs, description, Modifier/Supprimer), **formulaire
  modal** création/édition (`space-form.tsx`), **confirmation** avant suppression. Tuile KPI du
  cockpit « Espaces au catalogue » câblée sur le décompte réel.
- **4 états couverts** : vide (`mc-empty`), loading (`loading.tsx`), erreur (`error.tsx`),
  succès (toasts `sonner`).
- **Supabase** : `getSpacesForOrg` / `createSpace` / `updateSpace` / `deleteSpace` (demo ⇆
  Supabase), server actions avec `revalidatePath` ; jamais de `service_role` côté front.

### v1.7 — module Réservations (planning des créneaux) ✅
Quatrième module reconstruit selon le modèle de portage. **Nouvelle table métier + UI fidèle.**
- **Migration `0004_reservations.sql`** (idempotente) : table `reservations` (`organization_id` FK,
  `space_id` FK cascade, `person_id` FK set null, `title`, `start_at`/`end_at` timestamptz,
  `status`, `price`, `notes`, timestamps), index `(org, status)`, `(org, space, start)`,
  trigger `set_updated_at`, **contrainte EXCLUDE gist** anti-chevauchement (`btree_gist`),
  **RLS membre-only** (`reservations_member_all` via `is_org_member`). Seed : 6 réservations démo.
- **Primitives `mc-*`** ajoutées à `globals.css` : `mc-kanban`/`mc-kanban-col`/`mc-kanban-head`,
  `mc-resa-card`/`mc-resa-title`/`mc-resa-line`, `mc-agenda`/`mc-agenda-day`/`mc-agenda-date`.
- **Écran Réservations** (`reservations-view.tsx`) : `PageHeader` fidèle, **5 KPIs réels** (total,
  aujourd'hui, demandées, confirmées, annulées), toolbar (recherche + **3 vues kanban/agenda/table**
  + Nouvelle + reset), **filtres à chips** (espace/statut), **Kanban** 4 colonnes (Demandée /
  Confirmée / Terminée / Annulée), **Agenda** groupé par jour (today surligné), **Tableau** trié
  chronologiquement, clic → **drawer détail** (plage + durée, espace + type, réservant·e, prix,
  notes, **actions rapides** Confirmer / Terminer / Annuler, Modifier / Supprimer), **formulaire
  modal** création/édition (`reservation-form.tsx`), **confirmation** avant suppression.
- **Anti-chevauchement** double garde : pre-check applicatif (demo + Supabase) + contrainte SQL
  `EXCLUDE USING gist` → toast clair « Ce créneau chevauche une autre réservation ».
  Retour `{ ok, conflict? }` pour distinguer chevauchement d'erreur générique.
- **4 états couverts** : vide (`mc-empty`), loading (`loading.tsx`), succès (toasts `sonner`).
- **Supabase** : `getReservationsForOrg` / `createReservation` / `updateReservation` /
  `deleteReservation` (demo ⇆ Supabase), server actions avec `revalidatePath` ; jamais de
  `service_role` côté front. Tuile cockpit « Réservations du jour » câblée sur données réelles.

### Prochaines versions (ordre MVP)
Événements → Résidences → Documents → Finances → modules Publication /
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
| v1.6    | `v1.6-espaces`          | `fed88f1` | `archives\casa-minga-lieux-v1.6-espaces.zip`            |
| v1.7    | `v1.7-reservations`     | `e4ccdf3` | `archives\casa-minga-lieux-v1.7-reservations.zip`       |
