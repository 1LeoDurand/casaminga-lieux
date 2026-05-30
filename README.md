# Casa Minga Lieux

SaaS multi-tenant pour lieux collectifs (tiers-lieux, lieux culturels, résidences, espaces partagés).
Chaque lieu est une **organisation** ; toutes les données métier sont rattachées à un `organization_id`.
**Supabase** est la source de vérité ; `localStorage` n'est utilisé que pour des préférences d'UI / la démo.

> **v1 — socle technique.** Fondation : design system, routes de base, clients Supabase,
> première migration + seed, dashboard et site public minimaux.
>
> **v1.1 — premier flux end-to-end.** Site public → formulaire → création d'une demande →
> affichage dans le dashboard (module **Demandes**). Voir [ROADMAP.md](ROADMAP.md).
> Les autres modules métier (Personnes, Espaces, Réservations, Événements…) viendront ensuite.
>
> **v1.2 — flux Demandes branché sur Supabase réel.** Le même flux tourne désormais sur la
> vraie table `requests` (insertion publique anonyme via RLS, lecture dashboard réservée aux
> membres). Migration + seed appliqués, auth réelle + appartenance `organization_members`.
>
> **v1.3 — UI kit + shell dashboard fidèle.** Réorientation : portage beaucoup plus fidèle de
> l'interface **Claude Design** officielle sur `admin.casaminga.com` (UI kit `mc-*`, sidebar à
> groupement officiel Pilotage / Gestion du lieu / Structure / Publication / Système, topbar,
> cockpit « Vue d'ensemble »). **Couche purement visuelle** : le socle Supabase/auth/RLS et le
> flux Demandes v1.2 restent intacts. Les modules à venir s'annoncent par toast (pas de lien mort).
>
> **v1.4 — module Demandes fidèle (UI Claude Design + Supabase).** Premier module reconstruit
> selon [`docs/PLAN_RECONSTRUCTION.md`](docs/PLAN_RECONSTRUCTION.md) ; **modèle de portage** des
> modules suivants. Nouvelle vue Demandes (`requests-view.tsx`) : 5 KPIs réels, toolbar
> (recherche + export CSV), filtres à chips (type/statut/priorité), table → drawer détail,
> confirmation avant archivage. Primitives `mc-*` réutilisables (table, chips, stat-cards, empty,
> skeleton, drawer, confirm) + états vide/loading/erreur/succès. Table `requests` et RLS inchangées.

---

## Architecture des surfaces

| URL                                   | Surface                      | Route Next                              |
| ------------------------------------- | ---------------------------- | --------------------------------------- |
| `admin.casaminga.com/`                | Landing SaaS                 | `app/(admin)/page.tsx`                  |
| `admin.casaminga.com/login`           | Connexion équipe             | `app/(admin)/login/page.tsx`            |
| `admin.casaminga.com/dashboard/[org]` | Dashboard d'une organisation | `app/(admin)/dashboard/[org]/`          |
| `casaminga.com/[slug]`                | Site public généré du lieu   | réécrit vers `app/site/[slug]/page.tsx` |

Le routage par host est géré dans [`src/proxy.ts`](src/proxy.ts) : sur l'apex `casaminga.com`,
`/<slug>` est réécrit vers `/site/<slug>`. **En local, aucune réécriture** — tout est accessible
directement, le site public démo est sur `/site/bernard-kohn`.

---

## Démarrage rapide

```bash
cd "D:\01 Casaminga\01 Dev\casa-minga-lieux"
npm install
cp .env.example .env.local   # garde les placeholders → mode démo
npm run dev                  # http://localhost:3000
```

### Routes à tester en local

| Route                     | Attendu |
| ------------------------- | ------- |
| `/`                       | Landing SaaS |
| `/login`                  | Connexion (bandeau « mode démo » tant que Supabase n'est pas configuré) |
| `/dashboard/bernard-kohn` | Dashboard du lieu démo (KPIs + demandes récentes) |
| `/dashboard/bernard-kohn/demandes` | Module Demandes : liste, détail, changement de statut |
| `/site/bernard-kohn`      | Site public généré du lieu démo (formulaire de contact) |
| `/dashboard/inconnu`      | 404 |

### Tester le flux end-to-end (v1.1)

1. Ouvre `/site/bernard-kohn`, remplis le formulaire de contact, envoie.
2. Un toast confirme l'envoi ; la demande est créée (table `requests`, liée à `organization_id`).
3. Ouvre `/dashboard/bernard-kohn/demandes` : la demande apparaît en tête de liste.
4. « Voir détail » → change le statut, « Marquer traitée » ou « Archiver » (toast à chaque action).

> En **mode démo**, les demandes sont stockées en mémoire (singleton `globalThis`), partagées
> entre la route serveur et le dashboard pour la durée du process — réinitialisées au redémarrage.
> Avec Supabase configuré, tout passe par la table `requests` (RLS).

### Commandes

```bash
npm run dev      # serveur de développement (Turbopack)
npm run build    # build de production
npm run start    # serveur de production (après build)
npm run lint     # ESLint
```

---

## Mode démo vs Supabase

L'app démarre **sans clés Supabase**. Tant que `.env.local` contient les placeholders,
[`isSupabaseConfigured()`](src/lib/supabase/env.ts) renvoie `false` et les données proviennent
du seed local ([`src/lib/demo/data.ts`](src/lib/demo/data.ts)) — aucune requête réseau.

Pour brancher Supabase, renseigne dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé publique anon>
```

> **Sécurité.** Seules l'URL et la clé **anon** (publiques) vivent côté front.
> La clé `service_role` ne doit **jamais** être importée côté client ni committée — usage serveur strict.

### Migration + seed Supabase

Méthode CLI (projet lié) :

```bash
supabase db push                  # applique supabase/migrations/0001_init_socle.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # Bernard Kohn + site publié + 3 demandes
```

Méthode **SQL Editor** (sans CLI, utilisée en v1.2) : coller successivement le contenu de
`supabase/migrations/0001_init_socle.sql`, puis `supabase/seed.sql`, puis `supabase/verify.sql`
(vérification lecture seule : tables, RLS, policies, seed). Tous ces scripts sont **idempotents**.

Ensuite, deviens membre `admin` de Bernard Kohn :

1. Crée ton compte dans **Authentication → Users → Add user** (coche **Auto Confirm User**).
2. Récupère ton **User UID**, puis exécute le `insert into organization_members …`
   commenté en fin de [`supabase/seed.sql`](supabase/seed.sql).
3. Connecte-toi via `/login` → `/dashboard/bernard-kohn/demandes` montre les demandes
   (lecture filtrée par RLS via `is_org_member`).

> **Gotcha RLS.** L'insertion d'une demande depuis le site public se fait avec le client
> **anon** : la policy `requests_insert_from_public_site` l'autorise (site publié), mais
> aucune policy SELECT n'autorise l'anonyme à **relire** la ligne. On ne fait donc pas de
> `RETURNING`/`.select()` après l'insert — l'`id` est généré côté serveur
> (voir `createRequest` dans [`src/lib/data.ts`](src/lib/data.ts)).

---

## Structure du projet

```
src/
  proxy.ts                       # routage par host (apex → /site/[slug])
  app/
    layout.tsx                   # fonts (Poppins/Syne/DM Sans), lang fr, metadata
    globals.css                  # design system Casa Minga (tokens + @theme inline)
    (admin)/
      page.tsx                   # landing SaaS
      login/page.tsx             # connexion (réelle si Supabase configuré, sinon démo)
      dashboard/[org]/
        layout.tsx               # sidebar + topbar + org active
        page.tsx                 # KPIs + demandes récentes
        demandes/
          page.tsx               # module Demandes (liste + détail)
          actions.ts             # server actions (changement de statut)
    api/orgs/[slug]/requests/
      route.ts                   # POST public → création d'une demande
    site/[slug]/page.tsx         # site public généré
  components/
    ui/                          # primitives shadcn
    mc/                          # composants Casa Minga (sidebar, topbar, kpi-card,
                                 #   status-badge, public-contact-form, requests-board)
  lib/
    supabase/                    # env, client, server, middleware (updateSession)
    demo/data.ts                 # seed local (mode démo)
    demo/store.ts                # store mutable des demandes (mode démo, globalThis)
    data.ts                      # accès données (démo ⇆ Supabase) + create/update requests
    requests-meta.ts             # types de demande, statuts, priorités (libellés)
    types.ts                     # types métier alignés sur la migration
    modules.ts                   # 18 modules ("dashboard" + "demandes" actifs)
supabase/
  migrations/0001_init_socle.sql # organizations, profiles, organization_members, public_sites, requests + RLS
  seed.sql                       # organisation démo Bernard Kohn
.env.example                     # placeholders (aucune vraie clé)
```

---

## Design system

Tokens dans [`src/app/globals.css`](src/app/globals.css) : coral `#FF8A65`, coral-dark `#e8714d`,
peach, peach-pale, golden, cream, turquoise, mint, ink ; rayon 18px ; sidebar sombre `#2C2C2C`
avec item actif coral, topbar crème. Polices : **Poppins** (dashboard/public),
**Syne** (titres/landing), **DM Sans** (corps landing).

---

## Modèle de données (v1)

| Table                  | Rôle |
| ---------------------- | ---- |
| `profiles`             | profil lié à `auth.users` |
| `organizations`        | un lieu = une organisation (`slug` unique) |
| `organization_members` | appartenance + `role` (admin, coord, comm, finance, benevole, intervenant, readonly) + zones |
| `public_sites`         | site public d'une organisation (`status` brouillon/publié) |
| `requests`             | demandes entrantes (pont site public → équipe) |

RLS activé sur toutes les tables, adossé à `organization_members` via le helper
`is_org_member(org)`. Lecture publique uniquement sur les organisations / sites publiés.

---

## Prochaines étapes

1. ~~Fournir l'URL + clé anon Supabase, appliquer migration + seed, vérifier l'auth réelle
   et le flux Demandes branché sur la vraie table `requests`.~~ ✅ **fait en v1.2.**
2. Construire les modules métier suivants (ordre MVP) en respectant `organization_id` + RLS :
   Personnes → Espaces → Réservations → Résidences → Événements, etc.
3. **Versioning** : avant chaque nouvelle version, build OK → commit → tag → **archive depuis
   le tag** (`git archive`, jamais une copie du dossier de travail). Détail dans [ROADMAP.md](ROADMAP.md).
```
