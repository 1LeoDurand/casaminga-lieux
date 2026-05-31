# PASSATION — Casa Minga Lieux
> Document de reprise de contexte pour un changement d'ordinateur / compte Claude.
> À lire **en premier** avant de donner une instruction à Claude.
> Mis à jour au : **2026-05-30** (fin de session v1.7).

---

## 1. Identité du projet

| Champ | Valeur |
|---|---|
| Nom | **Casa Minga Lieux** |
| Dossier local | `D:\01 Casaminga\01 Dev\casa-minga-lieux` |
| Archives | `D:\01 Casaminga\01 Dev\archives\` |
| URL admin cible | `admin.casaminga.com` (dashboard multi-tenant) |
| URL publique cible | `casaminga.com/[slug]` (site public du lieu) |
| URL dev locale | `http://localhost:3000` |
| Supabase projet | `https://gzijdwrzcuokvfkpcczr.supabase.co` |
| Supabase anon key | dans `.env.local` (ne jamais afficher, jamais committer) |
| Token Claude PAT | `D:\01 Casaminga\Token claude.txt` (ne jamais lire avec Read tool, ne jamais afficher) |

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19, TypeScript 5 |
| Styles | Tailwind CSS v4 (CSS-based `@theme inline` dans `globals.css`, **pas de tailwind.config**) |
| Composants | shadcn/ui primitives + UI kit `mc-*` maison |
| Icônes | lucide-react |
| Toasts | sonner |
| Base de données | Supabase (PostgreSQL) via `@supabase/ssr` |
| Auth | Supabase Auth (`/login` → session cookie) |

---

## 3. Règles de sécurité immuables (TOUJOURS respecter)

```
- Ne jamais exposer service_role key côté front
- Ne jamais afficher ni pousser : SUPABASE_SERVICE_ROLE_KEY, mot de passe DB, token GitHub, clé secrète, .env.local
- Le token PAT (D:\01 Casaminga\Token claude.txt) : lire seulement en shell variable — JAMAIS avec Read tool — JAMAIS afficher
- Si GitHub demande une auth/token : arrêter et expliquer quoi faire
- Scope : uniquement admin.casaminga.com ; NE PAS toucher sejour.casaminga.com ni casaminga.com
- Tout doit rester dans D:\01 Casaminga (pas GDR)
- Bash CWD se réinitialise à D:\ecommunication\La Grande Conserve\14 GDR à chaque appel → toujours cd vers le projet
```

---

## 4. Architecture multi-tenant

- Chaque lieu = une **organisation** (`organizations` table, `slug` unique)
- Toutes les données métier = `organization_id` (FK)
- **RLS** sur toutes les tables, adossée à `is_org_member(org)` (helper security-definer dans migration 0001)
- Membre-only : lecture + écriture uniquement pour les membres de l'org
- **Mode démo** : quand `NEXT_PUBLIC_SUPABASE_URL` = placeholder → `isSupabaseConfigured()` → `false` → données locales (`src/lib/demo/`)
- **Supabase réel IS configuré** (`.env.local` a de vraies clés) → nouvelles tables doivent être migrées via SQL Editor pour apparaître

### Lieu de démo

```
org_id  : bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
slug    : bernard-kohn
URL     : /dashboard/bernard-kohn
```

---

## 5. Routage

```
src/proxy.ts   : sur apex casaminga.com, /<slug> → /site/<slug> (réécriture host)
/              : landing SaaS (admin.casaminga.com)
/login         : connexion (Supabase Auth)
/dashboard/[org]                    : cockpit
/dashboard/[org]/demandes           : module Demandes ✅
/dashboard/[org]/personnes          : module Personnes ✅
/dashboard/[org]/espaces            : module Espaces ✅
/dashboard/[org]/reservations       : module Réservations ✅
/site/[slug]                        : site public du lieu
```

---

## 6. Versions livrées

| Version | Tag git | Commit | Archive | Contenu |
|---|---|---|---|---|
| v1.0 | `v1.0-socle` | `77fc3d4` | inclus dans Git | Design system, routes, Supabase, migration 0001, seed |
| v1.1 | `v1.1-demandes` | `7162543` | `v1.1-demandes.zip` | Formulaire public → demande → dashboard |
| v1.2 | `v1.2-supabase-demandes` | `72e06a4` | `v1.2-supabase-demandes.zip` | Flux Demandes sur Supabase réel + RLS |
| v1.3 | `v1.3-ui-kit-shell` | `968da11` | `v1.3-ui-kit-shell.zip` | UI kit `mc-*` + shell dashboard fidèle |
| v1.4 | `v1.4-demandes` | `3356b68` | `v1.4-demandes.zip` | Module Demandes complet (kanban, filtres, drawer) |
| v1.5 | `v1.5-personnes` | `72459c1` | `v1.5-personnes.zip` | Module Personnes (CRM), table `persons`, RLS |
| v1.6 | `v1.6-espaces` | `fed88f1` | `v1.6-espaces.zip` | Module Espaces (catalogue), table `spaces`, RLS |
| v1.7 | `v1.7-reservations` | _à committer_ | _à archiver_ | Module Réservations (kanban/agenda), table `reservations`, anti-chevauchement |

> **État actuel** : v1.7 codée, build + lint ✅, en attente de validation visuelle puis commit/tag/archive.

---

## 7. Fichiers clés

```
src/
  lib/
    types.ts                  # Types métier (Organization, Person, Space, Reservation, …)
    modules.ts                # 18 modules nav (ready: true = construit)
    data.ts                   # Accès données (démo ⇆ Supabase) — point d'entrée unique
    requests-meta.ts          # Statuts/types/libellés Demandes
    persons-meta.ts           # Rôles/statuts/libellés Personnes
    spaces-meta.ts            # Types/statuts/helpers Espaces
    reservations-meta.ts      # Statuts/formats date-heure/overlap Réservations
    demo/
      data.ts                 # Seed local (DEMO_REQUESTS, DEMO_PERSONS, DEMO_SPACES, DEMO_RESERVATIONS)
      store.ts                # Store mutable globalThis (mode démo uniquement)
    supabase/
      env.ts                  # isSupabaseConfigured()
      client.ts / server.ts / middleware.ts
  app/
    globals.css               # Design system + UI kit mc-* (tokens + @theme inline)
    (admin)/dashboard/[org]/
      page.tsx                # Cockpit (Overview)
      layout.tsx              # Sidebar + topbar
      demandes/               # page + actions + loading + error
      personnes/              # page + actions + loading + error
      espaces/                # page + actions + loading + error
      reservations/           # page + actions + loading + error
  components/mc/
    # Composants Casa Minga (sidebar, topbar, page-header, kpi-tile, …)
    requests-view.tsx         # Vue Demandes
    persons-view.tsx / person-form.tsx
    spaces-view.tsx / space-form.tsx
    reservations-view.tsx / reservation-form.tsx
supabase/
  migrations/
    0001_init_socle.sql       # organizations, profiles, members, public_sites, requests + RLS
    0002_personnes.sql        # persons + RLS
    0003_espaces.sql          # spaces + RLS
    0004_reservations.sql     # reservations + EXCLUDE gist + RLS
  seed.sql                    # Org Bernard Kohn + personnes + espaces + réservations démo
```

---

## 8. Workflow de versioning (STRICT, à suivre à chaque module)

1. `npm run lint` → vert
2. `npm run build` → vert (route présente dans le tableau)
3. **Présenter à l'utilisateur + attendre validation visuelle**
4. Mettre à jour README.md + ROADMAP.md (section version + historique)
5. `git add` fichiers spécifiques (pas `git add -A`)
6. `git commit -m "vX.Y - Description"`
7. `git tag vX.Y-nom`
8. `git archive --format=zip --prefix=casa-minga-lieux-vX.Y-nom/ -o "D:/01 Casaminga/01 Dev/archives/casa-minga-lieux-vX.Y-nom.zip" vX.Y-nom`
9. Vérifier archive (no `.env.local`, no `node_modules`, no `.next`)
10. Commit ROADMAP avec hash : `docs: hash de version vX.Y dans l'historique ROADMAP`

---

## 9. Modèle de portage de module (toujours le même)

Pour chaque nouveau module `X` :

```
1. src/lib/types.ts            → ajouter types (Status, Interface)
2. src/lib/X-meta.ts           → statuts, badges, labels, helpers format
3. supabase/migrations/000N_X.sql → table, index, trigger, RLS (IDEMPOTENTE)
4. supabase/seed.sql           → INSERT ... ON CONFLICT DO NOTHING
5. src/lib/demo/data.ts        → DEMO_X[]
6. src/lib/demo/store.ts       → store globalThis + CRUD helpers
7. src/lib/data.ts             → getXForOrg, XInput, create/update/delete (démo ⇆ Supabase)
8. src/app/globals.css         → primitives mc-* pour ce module
9. src/app/(admin)/dashboard/[org]/X/actions.ts  → server actions + revalidatePath
10. src/components/mc/x-form.tsx     → formulaire modal (string values, parent fait la conversion)
11. src/components/mc/x-view.tsx     → vue principale ("use client")
12. src/app/(admin)/dashboard/[org]/X/page.tsx   → server: fetch org + data
13. src/app/(admin)/dashboard/[org]/X/loading.tsx → skeleton
14. src/app/(admin)/dashboard/[org]/X/error.tsx   → error boundary
15. src/lib/modules.ts         → ready: true
16. src/app/(admin)/dashboard/[org]/page.tsx → KPI cockpit câblé sur données réelles
```

---

## 10. Patterns essentiels

### Form state pattern
Les composants form gardent des **valeurs string** pour les champs numériques.
La conversion vers `number | null` se fait dans `submitForm` de la vue parente (via `toNum(s)`).
Jamais d'effet reset — le parent remonte avec une `key` différente pour état frais.

### Demo store pattern
```ts
const globalForDemo = globalThis as unknown as { __cmX?: X[] };
function xStore(): X[] {
  if (!globalForDemo.__cmX) globalForDemo.__cmX = DEMO_X.map(x => ({ ...x }));
  return globalForDemo.__cmX;
}
```

### Anti-lint `react-hooks/set-state-in-effect`
Interdit : setState synchrone dans useEffect. Solution : initialiser useState depuis props + remount via key.

### RLS comportement normal
Données vides en curl/non-authentifié = **correct** (RLS membre-only). Données visibles = connecté comme membre dans le navigateur.

### Server actions pattern
```ts
"use server";
import { revalidatePath } from "next/cache";
// Toujours revalidatePath sur la page du module ET le dashboard overview
```

### Conflit de créneau (Réservations)
- Demo : `findDemoReservationConflict()` dans store.ts (pre-check avant mutation)
- Supabase : pre-check query + contrainte GIST `EXCLUDE` (code erreur `23P01`)
- UI : toast spécifique « Ce créneau chevauche une autre réservation »
- Retour : `{ ok: boolean; conflict?: boolean }`

---

## 11. Design system mc-*

Tout dans `src/app/globals.css`. Tokens CSS via `@theme inline`.
Couleurs principales : coral `#FF8A65`, coral-dark `#e8714d`, peach, peach-pale, golden, cream, turquoise, mint, ink.

Classes UI kit disponibles (cumulatif v1 → v1.7) :
```
mc-badge, mc-badge-{green,red,orange,gray,lime,golden}
mc-btn, mc-btn-{outline,lime,sm}
mc-input, mc-textarea, mc-form-group, mc-form-label
mc-card, mc-stat, mc-stat-val, mc-stat-lbl, mc-kpi-grid, mc-kpi-row
mc-search, mc-search-ic
mc-chip, mc-filter-row, mc-filter-lbl, mc-chips
mc-view-toggle, mc-view-btn
mc-table, mc-table-wrap
mc-empty, mc-empty-ic, mc-empty-title, mc-empty-sub
mc-skeleton
mc-drawer, mc-drawer-ov
mc-modal, mc-modal-ov
mc-confirm, mc-confirm-ov
mc-avatar
mc-tag
mc-cards-grid, mc-person-card
mc-space-card, mc-space-cover, mc-space-cover-ph, mc-space-badges, mc-space-body
mc-space-meta, mc-space-meta-item, mc-space-price, mc-space-hero
mc-kanban, mc-kanban-col, mc-kanban-head, mc-kanban-title, mc-kanban-dot, mc-kanban-count, mc-kanban-empty
mc-resa-card, mc-resa-title, mc-resa-line, mc-resa-dot
mc-agenda, mc-agenda-day, mc-agenda-date, mc-agenda-date-sub, mc-agenda-items
```

---

## 12. Migrations Supabase (SQL Editor)

Méthode : SQL Editor de Supabase (Dashboard → SQL Editor → New query).
Chaque script est **idempotent** (ré-exécutable sans erreur).

Ordre d'application :
1. `supabase/migrations/0001_init_socle.sql`
2. `supabase/seed.sql` (base : org + site public + demandes)
3. `supabase/migrations/0002_personnes.sql` + seed personnes
4. `supabase/migrations/0003_espaces.sql` + seed espaces
5. `supabase/migrations/0004_reservations.sql` + seed réservations

Pour devenir membre admin de Bernard Kohn :
1. Créer compte dans Authentication → Users → Add user (cocher Auto Confirm User)
2. Récupérer User UID
3. Exécuter le `insert into organization_members` commenté à la fin de `seed.sql`

---

## 13. Prochaines versions (ordre MVP)

| Version | Module | Complexité | Dépendances |
|---|---|---|---|
| **v1.7** | ~~Réservations~~ ✅ | Haute | Espaces, Personnes |
| **v1.8** | **Événements** | Haute | Espaces, Personnes |
| **v1.9** | **Résidences** | Moyenne | Espaces, Personnes |
| **v1.10** | **Documents** | Moyenne | Personnes |
| **v1.11** | **Finances** | Haute | Personnes, Réservations |
| **v1.12** | **Médiathèque** | Moyenne | — |
| **v1.13** | **Site public (Vitrine)** | Haute | Espaces, Événements, Médiathèque |

**Table `events`** (v1.8) : id, org, space_id?, title, start_at, end_at, type (atelier/concert/expo/reunion/autre), status (brouillon/publie/annule), capacity, price, description, photos[], created/updated.

---

## 14. Commandes utiles

```bash
# Démarrer
cd "D:\01 Casaminga\01 Dev\casa-minga-lieux"
npm run dev

# Vérifier avant commit
npm run lint
npm run build

# Archiver depuis un tag
git archive --format=zip --prefix=casa-minga-lieux-<tag>/ -o "D:\01 Casaminga\01 Dev\archives\casa-minga-lieux-<tag>.zip" <tag>

# Ne jamais faire git add -A (risque .env.local)
git add fichier1 fichier2 ...
```

---

## 15. État actuel exact (2026-05-30, fin de session)

**Dernier commit commité** : `9fdc983` (docs: hash de version v1.6 dans l'historique ROADMAP)  
**v1.7 statut** : fichiers créés, build + lint ✅, **pas encore commité** — en attente validation visuelle de l'utilisateur.

Fichiers non encore commités (v1.7) :
```
src/lib/types.ts                          (+ Reservation, ReservationStatus)
src/lib/reservations-meta.ts              (NOUVEAU)
src/lib/demo/data.ts                      (+ DEMO_RESERVATIONS)
src/lib/demo/store.ts                     (+ reservation store)
src/lib/data.ts                           (+ getReservationsForOrg, create/update/delete)
src/app/globals.css                       (+ mc-kanban, mc-resa-card, mc-agenda)
src/app/(admin)/dashboard/[org]/page.tsx  (+ getReservationsForOrg, reservationsToday)
src/app/(admin)/dashboard/[org]/reservations/  (NOUVEAU: actions/page/loading/error)
src/components/mc/reservation-form.tsx    (NOUVEAU)
src/components/mc/reservations-view.tsx   (NOUVEAU)
src/lib/modules.ts                        (reservations → ready: true)
supabase/migrations/0004_reservations.sql (NOUVEAU)
supabase/seed.sql                         (+ 6 réservations démo)
```

**Après validation visuelle, faire** :
1. README.md → ajouter bloc v1.7 (même style que v1.5/v1.6)
2. ROADMAP.md → ajouter section `### v1.7 — Réservations ✅` + ligne historique
3. `git add` les fichiers ci-dessus + README + ROADMAP
4. `git commit -m "v1.7 - Réservations fidèle Claude Design + Supabase"`
5. `git tag v1.7-reservations`
6. `git archive ... casa-minga-lieux-v1.7-reservations.zip ... v1.7-reservations`
7. Commit ROADMAP hash : `docs: hash de version v1.7 dans l'historique ROADMAP`
8. Passer à **v1.8 Événements**

---

## 16. Instruction d'amorçage pour le prochain Claude

Coller au début d'une nouvelle session :

```
Je reprends le projet Casa Minga Lieux (admin.casaminga.com),
un SaaS multi-tenant pour tiers-lieux, en Next.js 16 / Supabase / Tailwind CSS v4.

Lis d'abord ces deux fichiers :
- D:\01 Casaminga\01 Dev\casa-minga-lieux\docs\PASSATION.md
- D:\01 Casaminga\01 Dev\casa-minga-lieux\ROADMAP.md

Règles immuables :
- Jamais service_role key côté front
- Jamais afficher/pousser .env.local, clés secrètes, token PAT
- Le token PAT est à D:\01 Casaminga\Token claude.txt : shell variable uniquement, jamais Read tool
- Scope strict : admin.casaminga.com uniquement
- Tout dans D:\01 Casaminga (pas GDR)
- Bash CWD reset → toujours cd vers le projet
- Workflow versioning STRICT : build → lint → présenter → attendre validation → commit → tag → archive

État actuel : v1.7 Réservations [à valider ou déjà validé].
Prochain module : v1.8 Événements.
```
