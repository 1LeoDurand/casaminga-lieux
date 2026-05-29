# Casa Minga Lieux

SaaS multi-tenant pour lieux collectifs (tiers-lieux, lieux culturels, résidences, espaces partagés).
Chaque lieu est une **organisation** ; toutes les données métier sont rattachées à un `organization_id`.
**Supabase** est la source de vérité ; `localStorage` n'est utilisé que pour des préférences d'UI / la démo.

> **v1 — socle technique.** Cette version pose une fondation propre et stable :
> design system, routes de base, client/serveur Supabase préparés, première migration + seed,
> dashboard et site public minimaux. Les modules métier (Demandes, Personnes, Espaces,
> Réservations, Événements…) seront construits dans les versions suivantes.

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
| `/site/bernard-kohn`      | Site public généré du lieu démo |
| `/dashboard/inconnu`      | 404 |

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

```bash
# via Supabase CLI, projet lié
supabase db push                  # applique supabase/migrations/0001_init_socle.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # Bernard Kohn + site publié + 3 demandes
```

Après inscription, ajoute-toi comme membre `admin` de Bernard Kohn
(instructions commentées en fin de [`supabase/seed.sql`](supabase/seed.sql)).

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
    site/[slug]/page.tsx         # site public généré
  components/
    ui/                          # primitives shadcn
    mc/                          # composants Casa Minga (sidebar, topbar, kpi-card, status-badge)
  lib/
    supabase/                    # env, client, server, middleware (updateSession)
    demo/data.ts                 # seed local (mode démo)
    data.ts                      # accès données (démo ⇆ Supabase)
    types.ts                     # types métier alignés sur la migration
    modules.ts                   # définition des 18 modules (seul "dashboard" actif en v1)
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

1. Fournir l'URL + clé anon Supabase, appliquer migration + seed, vérifier l'auth réelle.
2. Brancher le formulaire de contact du site public sur `requests`.
3. Construire les modules métier (ordre MVP) en respectant `organization_id` + RLS :
   Demandes → Personnes → Espaces → Réservations → Événements, etc.
4. **Versioning** : à chaque nouvelle version, copier le dossier courant en archive
   (ex. `casa-minga-lieux` → `casa-minga-lieux-v1`) avant de poursuivre en v1.1.
```
