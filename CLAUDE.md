# CLAUDE.md — admin.casaminga.com (Casa Minga Lieux)

## Contexte projet
Dashboard SaaS multi-tiers-lieux. Les organisations créent leur espace, gèrent adhésions, finances, événements, communauté, gouvernance.
Développeur : **Léo** (solo, équipe à venir).

## Stack
- Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4
- Supabase : `gzijdwrzcuokvfkpcczr` (org "Maison commune", eu-west-1)
- Dossier : `D:\0 - Sync cloud Kdrive\01 Casaminga\01 Dev\casa-minga-lieux`
- Repo GitHub : https://github.com/1LeoDurand/casaminga-lieux
- Branche principale : `main` / audit en cours : `audit/debug-session-01`

## Déploiement cible
**Infomaniak Node.js** (slot mutualisé). Build : `npm run build` → `.next/`

## ⚠️ Règles absolues
- **JAMAIS `npm run dev`** — kDrive provoque un OOM avec Turbopack. Utiliser `npm run start` uniquement.
- **JAMAIS `git add -A` ou `git add .`** — toujours ajouter les fichiers un par un par nom.
- **JAMAIS committer `.env.local`** — vérifier `.gitignore` avant tout commit.
- **JAMAIS afficher/loguer** le `service_role` key, les tokens GitHub, les mots de passe DB.
- **JAMAIS accepter un token GitHub** de Léo — Windows Credential Manager gère l'auth.

## Conventions
- Commits : **anglais** (ex: `feat: add export CSV`, `fix: null address on public site`)
- **Tags** : créer un tag git annoté après chaque module livré → `git tag vX.Y-nom-module <hash> -m "description"` + `git push origin <tag>`
- Commentaires de code : anglais
- Réponses Claude : **français**, court et direct, sans récapitulatif superflu
- Migrations Supabase : nommées `vX_Y_description` (ex: `v2_6_adhesions_payment_fields`)
- Status campagne adhésion : `"publie"` (pas `"public"`)

## Ecosystème Casa Minga
| App | URL | Stack | Supabase |
|---|---|---|---|
| **Admin** (ce projet) | admin.casaminga.com | Next.js 16 | gzijdwrzcuokvfkpcczr |
| **Séjours** | sejour.casaminga.com | Vite SPA | giekhaohqksirsadkfnt |
| **Public** | casaminga.com | À construire | gzijdwrzcuokvfkpcczr (même que admin) |

`casaminga.com` = plateforme publique type HelloAsso : associations, événements et levées de fonds de toutes les orgs sur admin.casaminga.com.

## Variables d'environnement (`.env.local`, non versionné)
```
NEXT_PUBLIC_SUPABASE_URL=https://gzijdwrzcuokvfkpcczr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

## Version courante
v2.8 — audit complet réalisé (2026-06-01)
