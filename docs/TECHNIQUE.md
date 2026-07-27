# Documentation technique — Casa Minga Lieux

Document vivant. Chaque chantier livré vient s'y inscrire, avec la raison des
choix et les pièges rencontrés. Ce qui n'est pas vérifié est signalé comme tel.

Dernière mise à jour : 26/07/2026.

---

## Repères d'architecture

| Élément | Valeur |
|---|---|
| Cadre | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4 |
| Données | Supabase (Postgres + RLS), projet `gzijdwrzcuokvfkpcczr` = **production** |
| Emails | nodemailer sur SMTP Infomaniak (pas d'ESP, donc pas de webhooks) |
| Hébergement | Infomaniak — **Build + Redémarrer manuels dans le manager**, un push ne déploie rien |
| IA | Gemini 2.5 Flash par défaut, repli Claude (`src/lib/grants/ai-draft.ts`) |

### Trois surfaces, un seul déploiement

Le routage se fait par nom de domaine dans `src/proxy.ts` (Next 16 a renommé
`middleware.ts` en `proxy.ts`) :

| Domaine | Sert |
|---|---|
| `admin.casaminga.com` | landing SaaS + tableau de bord |
| `casaminga.com/<slug>` | site public d'un lieu, **réécrit vers `/site/<slug>`** |
| `monlieu.fr` | même site sur domaine personnalisé, réécrit vers `/site/<slug>/…` |

**Le piège central de cette architecture** : sur le domaine public, *tout* chemin
est réécrit vers `/site/…`, sauf ceux listés dans `HOST_PASSTHROUGH`. Un fichier
attendu à la racine (`/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/.well-known/…`)
n'y arrive donc jamais tel quel. Il faut soit l'ajouter au passthrough, soit
créer la route sous `/site/`. C'est exactement ce qui rendait le domaine public
invisible aux moteurs jusqu'au 26/07 (voir plus bas).

---

## Module Newsletter

### Vue d'ensemble

Une campagne est une liste ordonnée de **blocs** (`src/lib/newsletter/types.ts`)
rendue en HTML compatible email — tables et styles en ligne, pas de flexbox.
Trois modes d'envoi : manuel, récurrent, sur événement.

| Fichier | Rôle |
|---|---|
| `types.ts` | blocs, campagne, réglages |
| `renderer.ts` | blocs → HTML email |
| `resolvers.ts` | résolution des blocs dynamiques (événements, adhésions, espaces) |
| `send.ts` | **envoi avec réservation et reprise** |
| `tracking.ts` | pixel et réécriture des liens (fonctions pures) |
| `events.ts` | écriture des ouvertures/clics |
| `data.ts` | lectures/écritures, désinscription, statistiques |

### Délivrabilité (RFC 8058)

`sendMail` accepte `unsubscribeUrl` et pose alors `List-Unsubscribe` +
`List-Unsubscribe-Post: List=One-Click`, exigés par Gmail et Yahoo depuis 2024.
L'URL passée doit être **l'endpoint** `/api/unsubscribe/<token>`, jamais la page
humaine : la RFC impose un POST sans confirmation, et une réponse 2xx **même sur
un jeton inconnu** — une erreur ferait croire au fournisseur qu'on refuse les
désinscriptions, ce qui coûte plus cher que la désinscription.

Tous les emails partent désormais en multipart avec une partie texte dérivée du
HTML (`htmlToText`). Le décodage des entités s'y fait **en une seule passe** :
un décodage en chaîne transformerait `&amp;lt;` en `<`, ce qui est faux.

> **Piège trouvé en production** : la désinscription ne fonctionnait pour
> personne. Les helpers passaient par le client soumis à la RLS, or la seule
> policy sur `persons` est `is_org_member()`. Un destinataire qui clique depuis
> sa boîte mail n'a aucune session → 404. Corrigé par un client `service_role`
> borné au filtre `unsubscribe_token`.
> **Règle générale : tout parcours exercé sans compte (désinscription, portail,
> billet, lien signé) doit contourner la RLS de façon explicite et bornée.**

### Consentement (RGPD art. 7)

Migration `v3_3_newsletter_preuve_de_consentement`. Sur `persons` :
`newsletter_consent_at / _ip / _source` et `newsletter_optout_at / _source`.

Seule l'IP de **confirmation** est conservée : l'étape 1 du double opt-in ne crée
volontairement aucune ligne, pour qu'on ne puisse pas énumérer les inscrits.

### Envoi : réservation et reprise

Migration `v3_4_newsletter_reprise_envoi`. Trois protections superposées :

1. **Réservation** — `claimCampaign` passe le statut à `en_cours` seulement si
   personne ne l'a fait. La condition est évaluée par Postgres, donc deux
   passages simultanés ne peuvent pas réussir tous les deux.
2. **Registre** `newsletter_deliveries` — une ligne par destinataire, écrite
   **avant** l'envoi. Entre les deux, on préfère un destinataire oublié à un
   destinataire servi deux fois.
3. **Contrainte unique** `(campaign_id, email)` — le filet, en base.

Le cron reprend toute campagne restée `en_cours` depuis plus de
`STALE_SEND_MINUTES` (15 min). Les modes automatiques créent la campagne **avant**
d'envoyer et avancent la cadence **avant** aussi : sans ligne en base il n'y a
rien à reprendre, et une date laissée en arrière relance une campagne entière.

> **Limite connue, non traitée** : la boucle reste synchrone dans une requête
> HTTP. La reprise la rend sûre, pas rapide. Au-delà de quelques centaines de
> destinataires, il faudra une vraie file.

### Suivi des ouvertures et des clics

Migration `v3_5_newsletter_suivi_ouvertures_clics`.

Le **jeton de suivi est l'id de la ligne `newsletter_deliveries`** : il existe
déjà, il est propre au couple (campagne, destinataire), et c'est un uuid
aléatoire donc indevinable. **Aucune adresse email ne circule dans les URL** —
un lien transféré ou un journal de serveur n'expose donc pas qui est abonné.

| Route | Rôle |
|---|---|
| `/api/n/o/<delivery>` | pixel GIF 1×1, répond **toujours** une image |
| `/api/n/c/<delivery>?u=…&s=…` | redirection de clic, redirige **toujours** |

Deux règles à ne jamais assouplir :

- La mesure ne doit jamais abîmer ce qu'elle mesure. Un pixel en erreur dessine
  une icône d'image cassée dans le message ; un lien qui échoue ne mène nulle
  part. Les deux routes réussissent donc même si la base est indisponible.
- **L'URL cible est signée** (HMAC, `tracking.ts`). Sans signature, l'endpoint
  serait une redirection ouverte permettant de maquiller un lien d'hameçonnage
  derrière notre domaine.

L'instrumentation se fait **en post-traitement du HTML**, pas dans le renderer :
les blocs n'ont pas à savoir qu'on mesure, et l'aperçu comme l'email de test
restent des HTML propres. Le lien de désabonnement n'est jamais suivi.

Interrupteur par organisation : `newsletter_settings.suivi_actif` (défaut actif).
Statistiques agrégées : vue `newsletter_campaign_stats`, en `security_invoker`
pour qu'elle respecte les RLS et ne devienne pas une porte dérobée inter-organisations.

> **Fiabilité à rappeler dans l'interface** : la plupart des clients mail
> masquent les images et Gmail les sert via son proxy. Le taux d'ouverture est
> une tendance, jamais un décompte. L'interface affiche « % au moins ».

---

## Site public

### Pages

`/site/[slug]` + pages activables : `a-propos`, `agenda` (+ `agenda/[id]`),
`espaces`, `soutenir`, `adhesion/[campaignSlug]`. Onze thèmes visuels
(`themes.ts`) : un thème ne change que des classes, jamais le contenu — **aucun
réglage d'apparence ne peut casser un site**, principe à conserver.

### Pages légales (26/07)

`mentions-legales` et `confidentialite` sont **obligatoires et non
désactivables** (LCEN art. 6 III et RGPD), liées depuis le pied de page.

Règle de `src/lib/site-public/legal.ts` : **ne jamais inventer une information
légale**. Ce que nous ne détenons pas est affiché comme « à compléter par la
structure », jamais comblé par une valeur vraisemblable. Une mention fausse est
un risque porté par le client.

Ces deux pages sont en `robots: noindex, follow` — elles ne répondent à aucune
recherche et dilueraient le référencement du lieu.

> **Découvert en vérifiant** : `CookieBanner` et `GoogleAnalytics` sont montés
> dans le **layout racine**, donc actifs sur les sites de tous les clients.
> L'implémentation est correcte (chargement seulement après acceptation
> explicite, `anonymize_ip`, bouton Refuser), mais la politique de
> confidentialité de chaque lieu doit le mentionner — c'est fait.
> **Question produit ouverte** : mesurer l'audience des sites clients sous notre
> compte GA est-il légitime, ou faut-il la leur restituer ?

### Référencement (26/07)

Le domaine public n'avait **ni `robots.txt` ni `sitemap.xml`** : le proxy
réécrivait ces chemins vers `/site/robots.txt`, qui n'existait pas. Les sites
des lieux n'étaient donc soumis à aucun moteur.

| Route | Sert |
|---|---|
| `src/app/robots.ts`, `sitemap.ts` | `admin.casaminga.com` (inchangé) |
| `src/app/site/robots.txt`, `site/sitemap.xml` | `casaminga.com` — tous les sites publiés |
| `src/app/site/[slug]/robots.txt`, `sitemap.xml` | domaines personnalisés |

Un segment statique l'emporte sur `[slug]` : pas d'ambiguïté de routage.

Deux règles du contenu du sitemap :

- **seuls les sites `publie`** — un brouillon ne doit jamais être soumis ;
- **seuls les événements `publie` et à venir** — la RLS est plus large (elle
  laisse passer `confirme` et `planifie`), mais ces événements ne sont pas
  affichés, et soumettre une URL que le site n'affiche pas est une erreur.

Le rendu XML est isolé dans `sitemap-xml.ts`, sans `server-only`, pour rester
testable hors Next. Les fonctions qui lisent la base restent dans `sitemap-data.ts`.

---

## Conventions de travail

### Vérifier

```bash
npx tsc --noEmit
```

```bash
NODE_OPTIONS='--max-old-space-size=1536' npx next build
```

Les avertissements « module not found » sur les polices Google pendant le build
sont du bruit réseau, pas une erreur.

**Ne jamais lancer `npm run dev`** : Turbopack sur un dossier kDrive synchronisé
fait exploser la mémoire. Pour vérifier dans un navigateur : `next build` puis
`next start`. Attention, `.claude/launch.json` contient encore une entrée `dev` —
utiliser l'entrée `start`.

### Tester

Pas de cadre de tests installé. Les vérifications se font par scripts jetables
`npx tsx`, supprimés après usage, et par assertions SQL pour ce que Postgres
garantit (contraintes, atomicité, cascades). Écrire les tests **là où la règle
est appliquée** : une contrainte unique se teste en base, pas en TypeScript.

### Ce qui ne se déduit pas du code

- Un push ne déploie rien : **Build + Redémarrer** dans le manager Infomaniak.
- Le projet Supabase est la production. Pas d'écriture de test sur des données
  réelles ; les campagnes de test sont créées puis supprimées dans la même
  transaction.
- Les emails de relance doivent toujours permettre d'agir sans compte, via un
  lien signé.

---

## Chantiers en attente

- **Centre d'aide et documentation utilisateur** — voir le ticket dédié.
- File d'envoi pour les newsletters de plus de quelques centaines de destinataires.
- Pages libres du site public composées avec le moteur de blocs de la newsletter.
- Génération des supports de communication (affiche, flyer, post) via
  `ImageResponse` — voir `PLAN_COMMUNICATION_2026-07-26.md`.
