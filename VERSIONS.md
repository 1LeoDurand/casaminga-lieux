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

## 🔜 Versions à venir

> **Ordre MVP** : chaque module suit exactement le même modèle de portage (voir `docs/PASSATION.md`).
> Build + lint avant chaque commit. Validation visuelle avant commit/tag/archive.

---

### v1.8 — Module Événements
**Priorité** : haute · **Dépend de** : Espaces, Personnes

**Ce qu'il faut faire :**
- Table `events` : `id`, `organization_id`, `space_id?`, `title`, `start_at`, `end_at`,
  `type` (atelier/concert/expo/reunion/autre), `status` (brouillon/publie/annule),
  `capacity`, `price`, `description`, `photos text[]`, timestamps + RLS membre.
- ⚠️ La table `evenements` **existe déjà** en Supabase (vide, RLS active) — inspecter sa structure
  avant de créer la migration pour ne pas dupliquer ou casser.
- Vue : cartes événements + agenda + KPIs (à venir, cette semaine, publiés, brouillons).
- KPI cockpit « Événements à venir » câblé (aujourd'hui illustratif hardcodé).
- `src/lib/events-meta.ts` : types, statuts, badges, formatters.

> **Note dev** : les événements peuvent avoir ou non un espace associé (conférence en ligne = pas
> d'espace). `space_id` nullable. Chevauchement d'espace à vérifier comme pour les réservations
> (mais optionnel : un événement sans espace ne peut pas chevaucher).

---

### v1.9 — Module Résidences
**Priorité** : moyenne · **Dépend de** : Espaces, Personnes

**Ce qu'il faut faire :**
- Table `residences` : `id`, `organization_id`, `space_id`, `person_id`, `title`, `start_date`,
  `end_date` (dates, pas timestamptz), `status` (candidature/acceptee/en_cours/terminee/refusee),
  `discipline`, `description`, `notes`, timestamps + RLS.
- Vue : liste/cartes résidences, timeline, filtres statut/discipline, drawer détail.
- Vigilance : chevauchement d'espace avec Réservations et Événements.

---

### v1.10 — Module Documents
**Priorité** : moyenne · **Dépend de** : Personnes

**Ce qu'il faut faire :**
- Table `documents` : `id`, `organization_id`, `person_id?`, `title`, `type`
  (contrat/devis/facture/convention/autre), `status` (brouillon/envoye/signe/archive),
  `file_url`, `file_name`, `file_size`, `notes`, timestamps + RLS.
- Upload via **Supabase Storage** (bucket `documents`, policy membre).
- Vue : liste fichiers, filtres type/statut, aperçu, téléchargement.

> **Note dev** : premier module avec Supabase Storage. Créer un bucket `documents` dans
> le dashboard Supabase avant le développement. La policy Storage est séparée de la RLS table.

---

### v1.11 — Module Finances
**Priorité** : haute · **Dépend de** : Personnes, Réservations

**Ce qu'il faut faire :**
- Table `transactions` : `id`, `organization_id`, `person_id?`, `type` (recette/dépense),
  `amount`, `date`, `category`, `status` (en_attente/validee/annulee), `notes`, timestamps.
- Table `invoices` (optionnel v1) : numéro, person_id, montant, échéance, statut (payée/impayée).
- Vue : graphiques barres (recettes vs dépenses), table transactions, KPIs trésorerie.
- ⚠️ Graphiques : utiliser une lib légère (ex. recharts ou chart.js) — à ajouter comme dépendance.

---

### v1.12 — Médiathèque
**Priorité** : moyenne · **Dépend de** : rien (alimente Site public + Communication)

**Ce qu'il faut faire :**
- Table `media` : `id`, `organization_id`, `title`, `type` (photo/video/audio/document),
  `url`, `thumbnail_url`, `alt_text`, `tags text[]`, `size`, timestamps + RLS.
- Upload Supabase Storage (bucket `media`, images).
- Vue : galerie + liste, filtres type/tags, aperçu, drag-drop optionnel.

---

### v1.13 — Site public (Vitrine enrichie)
**Priorité** : haute · **Dépend de** : Espaces, Événements, Médiathèque

**Ce qu'il faut faire :**
- Enrichir `/site/[slug]` : présenter les espaces disponibles, les événements publiés, galerie.
- Pages : accueil → espaces → événements → contact (formulaire existant).
- Données publiques via RLS read-only (policy SELECT anon sur `spaces` status=disponible
  et `events` status=publie).

> **Note dev** : actuellement `/site/[slug]` = page formulaire seule. Garder le formulaire,
> ajouter sections. Le proxy `src/proxy.ts` est déjà en place pour le routage apex.

---

### v1.14 — Communication
**Priorité** : moyenne · **Dépend de** : Personnes, Médiathèque

Campagnes email, newsletters, annonces internes.
Table `messages` : destinataires (segment de personnes), objet, corps, statut (brouillon/envoyé).
Intégration email à décider (Resend ? Supabase Edge Functions ?).

---

### v1.15 et + — Gouvernance / Impact / Automatisations / Paramètres
À planifier après les modules fondamentaux. Voir `docs/PLAN_RECONSTRUCTION.md` pour le détail.

---

## Conventions rappel rapide

```
Bash CWD reset → toujours cd "D:/0 - Sync cloud Kdrive/01 Casaminga/01 Dev/casa-minga-lieux"
Workflow : lint → build → présenter → valider → commit → tag → archive
Archive : git archive --format=zip --prefix=casa-minga-lieux-<tag>/ -o "D:/0 - Sync cloud Kdrive/01 Casaminga/01 Dev/archives/casa-minga-lieux-<tag>.zip" <tag>
Jamais : service_role key côté front · .env.local commité · git add -A
MCP Supabase : connecté → project_id = gzijdwrzcuokvfkpcczr
```
