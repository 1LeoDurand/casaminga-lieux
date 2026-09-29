# CLAUDE.md — admin.casaminga.com (Casa Minga Lieux)

## Contexte projet
Dashboard SaaS multi-tiers-lieux. Les organisations créent leur espace, gèrent adhésions, finances, événements, communauté, gouvernance.
Développeur : **Léo** (solo, équipe à venir).

## Stack
- Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4
- Supabase : `gzijdwrzcuokvfkpcczr` (org "Maison commune", eu-west-1)
- Dossier : `D:\0 - Sync cloud Kdrive\01 Casaminga\01 Dev\casa-minga-lieux`
- Repo GitHub : https://github.com/1LeoDurand/casaminga-lieux
- Branche principale : `main` (la branche locale `audit/debug-session-01` est ancienne : ne pas y travailler sans l'accord de Léo)

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
- **Tags** : créer un tag git annoté après chaque module livré → `git tag vX.Y-nom-module <hash> -m "description"` (en local ; le tag ne part qu'avec un push autorisé par Léo, comme le reste)
- Commentaires de code : anglais
- Réponses Claude : **français**, court et direct, sans récapitulatif superflu
- Migrations Supabase : fichiers `supabase/migrations/00NN_description.sql` (numéro à 4 chiffres, ex : `0021_outreach.sql`) ; l'ancienne convention `vX_Y_description` ne s'applique plus depuis 0001
- Status campagne adhésion : `"publie"` (pas `"public"`)

## Ecosystème Casa Minga
| App | URL | Stack | Supabase |
|---|---|---|---|
| **Admin** (ce projet) | admin.casaminga.com | Next.js 16 | gzijdwrzcuokvfkpcczr |
| **Séjours** | sejour.casaminga.com | Vite SPA | giekhaohqksirsadkfnt |
| **Public** | casaminga.com | À construire | gzijdwrzcuokvfkpcczr (même que admin) |

`casaminga.com` = plateforme publique type HelloAsso : associations, événements et levées de fonds de toutes les orgs sur admin.casaminga.com.

## Catalogue public : modération éditoriale (contexte, 2026-09-11)

L'admin est le **futur point de modération éditoriale** du catalogue
d'événements de casaminga.com : le portail public reste en lecture seule, et
toute validation, sélection ou mise en avant sera écrite ici. Décision de
référence : `D:\0 - Sync cloud Kdrive\01 Casaminga\0.2 Contexte public-casaminga\00-CONTEXTE-PRODUIT.md`.

- Existant à réutiliser plutôt qu'à dupliquer : `/admin/moderation` et
  `setEventPortalStatus` (`evenements.portal_status` : `pending`, `approved`,
  `rejected`).
- Rien n'est à construire tant que restent ouverts : critères de validation,
  rôle qui valide, modèle de données des axes d'impact et de la mise en avant.
- sejour.casaminga.com (autre base) n'est pas concerné.

## Déploiement SSH Infomaniak

**Un `git push` sur `main` déclenche le build de production.** Le workflow
`.github/workflows/deploy.yml` appelle l'API Infomaniak, qui fait le `git pull`
et le build configurés dans le panel. Constaté le 26/09/2026 : la phrase
précédente de cette section, « un git push ne déploie rien », était fausse
depuis le 03/06/2026.

Constaté le 27/07/2026 sur le serveur, contre ce que disait cette section :

- le chemin du slot est **`/srv/customer/sites/admin.casaminga.com`** (et non
  `~/admin.casaminga.com`) ;
- **`pm2` n'existe pas** sur ce slot. L'application est lancée par le
  gestionnaire Node.js d'Infomaniak — c'est lui qui expose le flux de journaux
  (« Connected to stream ») et c'est **depuis le manager que l'on redémarre** ;
- les variables d'environnement sont lues dans `.env` **et** `.env.local` du
  dossier ci-dessus, `.env.local` ayant priorité (Next charge les deux).

```bash
# Sur le serveur, en SSH
cd /srv/customer/sites/admin.casaminga.com
git pull
npm run build
# puis Redémarrer DEPUIS LE MANAGER Infomaniak (pas de pm2 ici)
```

> Toute commande `pm2 …` trouvée dans une consigne ou un ancien document est à
> considérer comme périmée pour ce slot.

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
