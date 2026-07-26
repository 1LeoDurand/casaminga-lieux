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

## Emails actionnables

<a id="emails-actionnables"></a>

Règle produit. **Tout email de relance doit permettre d'agir depuis l'email**,
sans compte ni mot de passe. Sinon le cron harcèle des gens déjà à jour, et
l'équipe n'a pas la capacité de vérifier chaque semaine qui a payé / qui vient.

Quatre exigences, pour chaque relance :
1. **Un lien qui agit** — magic-link HMAC (`src/lib/portal/token.ts`), route
   `/espace/<token>/<objet>/<id>`. Le token signe l'email ; la page revérifie
   que l'objet appartient bien à cet email.
2. **L'action arrête les relances** — le cron doit filtrer sur le champ posé
   par le client (`payment_declared_at`, `renewal_intent_at`…).
3. **L'équipe est prévenue** — email aux admins actifs de l'org + étiquette
   visible dans le dashboard. La notification ne doit jamais bloquer l'action
   (try/catch).
4. **Jamais de vérité comptable sans humain** — une déclaration client ne passe
   pas une facture en `payee`. Seule la validation par l'équipe fait foi.

Dégradation propre attendue : sans `PORTAL_LINK_SECRET`, l'email part **sans**
le bouton plutôt que d'échouer.

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

## Déploiement SSH Infomaniak

Connexion : SSH sur le slot Infomaniak (pas d'interface Vercel, pas de CI/CD automatique).
Procédure après `git push` :
```bash
# Sur le serveur Infomaniak
cd ~/admin.casaminga.com   # ou le chemin du slot
git pull
npm run build
pm2 restart casa-minga     # ou le nom du process pm2
```

### Check après upgrade

À passer après chaque Build + Redémarrer, avant de considérer le déploiement clos.

- [ ] **`PORTAL_LINK_SECRET` présente dans le `.env` du serveur.** Elle signe tous
      les liens « agir depuis l'email » (déclarer un paiement, annuler une place,
      ne pas renouveler) — cf. [règle des emails actionnables](#emails-actionnables).
      Sans elle, **pas de plantage** : les emails partent simplement sans le bouton,
      donc la panne est silencieuse. Vérifier explicitement :
      `grep -c PORTAL_LINK_SECRET .env` doit renvoyer `1`.
- [ ] Une page publique répond (`curl -s -o /dev/null -w '%{http_code}' https://admin.casaminga.com/espace` → 200).
      Un 500 = build périmé, cf. [[build-deploy-gotchas]].
- [ ] Les crons GitHub Actions ont tourné sans 401 (onglet Actions → `invoicing-cron`).

## Variables d'environnement (`.env.local` local / `.env` serveur SSH, non versionné)

Ajouter dans le `.env` du serveur Infomaniak via SSH :
```bash
echo "PORTAL_LINK_SECRET=\"$(openssl rand -base64 32)\"" >> .env
```
Puis redémarrer le process (`pm2 restart …`).

> ⚠️ La valeur en clair de `PORTAL_LINK_SECRET` était écrite en dur ici, dans la
> copie de travail (jamais commitée — vérifié : absente de tout l'historique).
> Elle a été remplacée par la commande de génération le 26/07/2026. **Ne jamais
> recoller la valeur réelle dans un fichier versionné** : ce secret signe les
> magic-links du portail, qui le connaît peut forger un lien d'accès à l'espace
> de n'importe quel adhérent.

Variables requises :
```
NEXT_PUBLIC_SUPABASE_URL=https://gzijdwrzcuokvfkpcczr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
PORTAL_LINK_SECRET=<secret HMAC pour les magic-links espace adhérent>
```

Assistant IA brouillons de subvention (`src/lib/grants/ai-draft.ts`) — optionnel :
```
GEMINI_API_KEY=<clé Google AI Studio>   # palier gratuit, fournisseur par défaut si présent
GEMINI_MODEL=gemini-2.5-flash           # optionnel (défaut : gemini-2.5-flash)
AI_DRAFT_PROVIDER=auto                  # auto | gemini | claude (défaut : auto)
ANTHROPIC_API_KEY=<clé Anthropic>       # repli si Gemini absent / AI_DRAFT_PROVIDER=claude
```
Clé Gemini gratuite : https://aistudio.google.com/apikey

## Version courante
v2.8 — audit complet réalisé (2026-06-01)
