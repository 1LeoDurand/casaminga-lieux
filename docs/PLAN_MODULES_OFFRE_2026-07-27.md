# Modules et offre commerciale — état réel et mise en place

Document de décision. État du code au 27/07/2026.

---

## 1. Ce que tu as déjà — et c'est beaucoup

| Brique | Où | État |
|---|---|---|
| 24 modules déclarés, 6 sections, 3 couches | `src/lib/modules.ts` | complet |
| 3 offres (`free` / `complete` / `multilieu`) | `OrgTier` | déclaré |
| `minTier` par module | `modules.ts` | déclaré |
| 6 archétypes qui pré-activent les bons modules | `ORG_ARCHETYPES` | complet |
| Activation par organisation | table `organization_modules` — **72 lignes** | en service |
| Abonnements | table `subscriptions` — **0 ligne** | vide |
| Interrupteur de bêta | `src/lib/beta.ts` | actif |

L'architecture modulaire est **déjà là et elle est bonne**. La question n'est
donc pas « comment la construire » mais « qu'est-ce qui manque pour en faire une
offre ».

## 2. Le problème : le verrou n'existe nulle part

`minTier` n'est lu **qu'à un seul endroit** : `dashboard-sidebar.tsx`, pour
griser une entrée de menu. Sur 47 pages du tableau de bord, **3 seulement**
consultent les modules — et ce sont le layout, la page Modules et l'accueil,
c'est-à-dire de la navigation, pas des gardes.

Concrètement, `finances/page.tsx` charge les transactions sans poser une seule
question sur l'offre. Il en va de même pour les *server actions*, qui écrivent.

**Le jour où tu passes `BETA_OPEN_ALL_MODULES=false`, ton paywall sera un menu
qui cache des liens.** Taper l'URL suffit à le contourner ; et quiconque a mis
une page en favori pendant la bêta continuera de s'en servir sans rien voir.

Ce n'est pas grave aujourd'hui — tout est ouvert, c'est cohérent. Ça le devient
le jour de la commercialisation, et ça ne se répare pas en une soirée : c'est
47 pages et autant d'actions.

Second point : `subscriptions` est **vide** alors que 13 organisations existent.
Le jour où la bêta se referme, `getOrgSubscription` renvoie `free` pour tout le
monde. Tes utilisateurs de la première heure perdraient tout d'un coup.

Bonne nouvelle : le champ `founding_member` existe déjà et `effectiveTier` le
traite comme `complete`. **Le geste juste est déjà codé, il reste à l'exécuter.**

---

## 3. WordPress : le bon réflexe, le mauvais modèle

Ton intuition modulaire est juste. La référence WordPress, elle, mélange deux
choses très différentes :

| | Ce que c'est | Ce que ça coûte |
|---|---|---|
| **Modularité** | l'utilisateur active/désactive ce qu'il voit | tu l'as déjà |
| **Extensibilité** | du code **tiers** s'exécute dans ton application | 2 à 3 ans de travail |

Le second modèle suppose une API publique stable, un bac à sable, un processus
de revue, une place de marché, un partage de revenus, et une matrice de versions
à tester. Surtout, l'écosystème de greffons est **la principale cause de
compromission de WordPress** : du code tiers à côté d'une base qui contient la
comptabilité et les fichiers d'adhérents de tes clients, c'est un risque que tu
n'as aucune raison de prendre à ce stade.

**Tu n'as pas besoin d'extensibilité. Tu as besoin d'un emballage commercial.**

Ce qui est reprenable de WordPress, en revanche : le **manifeste**. Formaliser
ce que `modules.ts` décrit déjà à moitié — routes, tables, permissions, offre
minimale, quotas — pour qu'ajouter un module n'oblige jamais à toucher au reste.
C'est du confort interne, sans aucun des risques.

---

## 4. À la carte ou par paliers ?

Ton code a déjà tranché sans que tu l'aies formalisé : sur 24 modules, tout est
soit gratuit, soit `complete`. Aucun module ne demande `multilieu`. Autrement
dit, tu as **deux offres**, pas vingt-quatre options.

Je recommande de l'assumer. La vente à la carte paraît généreuse et se retourne :

- 24 cases à cocher, c'est une décision à prendre 24 fois — pour un bureau
  d'association qui doit justifier chaque dépense, c'est 24 occasions de dire
  « on verra plus tard » ;
- au-delà de trois modules, le client calcule et bascule sur l'offre complète :
  tu auras payé la complexité sans en tirer le prix ;
- et 24 modules indépendants, c'est un nombre ingérable de combinaisons à
  tester et à dépanner.

**Paliers pour vendre, modules pour l'expérience.** Les modules restent ce
qu'ils font déjà très bien : ne montrer que ce dont le lieu se sert.

### Une exception qui vaut la peine

Deux ou trois **options** vraiment séparables, à coût marginal réel : nom de
domaine personnalisé, caisse certifiée NF525, multi-lieux. Elles se vendent à
part parce qu'elles se comprennent seules — pas parce qu'on a découpé.

---

## 5. Ce qui doit être gratuit

Le gratuit ne sert pas à donner un aperçu. Il sert à ce que le lieu **dépose ses
données chez toi** : ses membres, ses événements, son site. À partir de là, le
payant n'est plus un achat, c'est la suite logique.

| Gratuit — « exister en ligne » | Payant — « gagner du temps et de l'argent » |
|---|---|
| Site public, événements, adhésions | Finances, facturation, dépenses |
| Personnes, demandes | Subventions, dons et reçus fiscaux |
| Équipe, paramètres | Documents et signature, gouvernance |
| | Newsletter au-delà d'un seuil |

C'est presque exactement ta répartition actuelle. Un déplacement à envisager :
la **newsletter** est aujourd'hui entièrement payante, alors que c'est elle qui
fait revenir les gens sur le site. Je la rendrais gratuite jusqu'à ~200
destinataires — le seuil est un meilleur verrou qu'une porte fermée.

### Le module qui vend, c'est Subventions

Une seule subvention obtenue paie plusieurs années d'abonnement. C'est le seul
module dont le retour se démontre en une phrase — et tu as déjà 1 245 aides
importées. C'est là qu'il faut mettre la démonstration, pas sur la facturation.

---

## 6. La règle qui décide de tout : où placer le verrou

C'est le vrai sujet d'UX, et il tient en une phrase.

> **Le verrou porte sur la sortie, jamais sur la lecture de ses propres données.**

Autrement dit :

- **Jamais bloqué** : consulter, chercher, exporter ce qu'on a déjà saisi. Une
  association qui ne peut plus lire sa propre comptabilité parce qu'elle a
  suspendu son abonnement, c'est indéfendable — et le droit à la portabilité
  du RGPD ne s'accommode pas d'un paywall.
- **Bloqué** : produire le résultat. Générer le dossier, envoyer les 500
  courriels, éditer le reçu fiscal, signer le document.

Ce placement change tout dans la perception : on ne dit pas « payez pour
entrer », on dit « votre travail est prêt, voici comment le sortir ». La valeur
est démontrée **avec leurs données à eux** avant qu'on demande quoi que ce soit.

Trois anti-modèles à écarter :

1. **Cacher le module.** Personne ne peut vouloir ce qu'il ignore.
2. **Le mur au clic.** Frustration immédiate, aucune valeur démontrée.
3. **Le verrou après-coup** — laisser saisir puis interdire de consulter. C'est
   celui qui fait résilier *et* mal parler de toi.

---

## 7. Mise en place, dans l'ordre

### Étape 1 — Séparer deux notions aujourd'hui confondues

`getEnabledModules` répond à une seule question, alors qu'il y en a deux :

- **`enabled`** : le lieu a choisi de s'en servir *(UX)*
- **`entitled`** : son offre le permet *(commercial)*

Les deux produisent des écrans opposés : « activez ce module » d'un côté,
« votre offre ne comprend pas ceci » de l'autre. Tant qu'ils sont mélangés, on
ne peut afficher ni l'un ni l'autre correctement.

À faire : `getModuleAccess(orgId)` renvoyant `{ enabled, entitled }` par clé.

### Étape 2 — Le garde, avant tout le reste

Un seul point d'entrée, appelé en tête de chaque page et de chaque action
d'écriture :

```ts
await requireModule(orgSlug, "finances");
```

47 pages. C'est répétitif et sans gloire, mais **c'est la seule étape qui rend
le paywall réel**. Tant qu'elle n'est pas faite, tout le reste est décoratif.
À faire pendant que la bêta est encore ouverte : le garde ne bloque rien tant
que `BETA_OPEN_ALL_MODULES` est vrai, donc c'est sans risque aujourd'hui — et
impossible à rattraper sereinement le jour J.

### Étape 3 — Un seul composant de blocage

Un composant unique, réutilisé partout, qui dit trois choses : ce que le module
apporte, ce que ça coûte, et ce qui a déjà été fait avec leurs données
(« 12 aides correspondent à votre lieu »). Un paywall différent par page, c'est
un produit qui a l'air bricolé au moment précis où l'on demande de l'argent.

### Étape 4 — Honorer les 13 comptes de la bêta

Avant de refermer : créer les lignes `subscriptions` manquantes avec
`founding_member = true`. Le code sait déjà quoi en faire. Et le leur dire —
c'est le meilleur message commercial que tu enverras cette année.

### Étape 5 — Seuils plutôt que portes

Là où c'est possible, préférer un quota à un verrou binaire : nombre
d'adhérents, de destinataires, de factures par an. Un seuil laisse entrer, se
franchit au moment où le besoin est réel, et se justifie tout seul.

### Étape 6 — Facturation

Stripe est déjà branché pour la billetterie (Connect), mais l'abonnement, c'est
un autre objet : Billing, webhooks, période d'essai, échec de paiement, relance.
À traiter comme un chantier à part entière, pas comme une extension du
précédent.

---

## 8. À trancher avant de commencer

1. **Deux offres ou trois ?** `multilieu` n'est requis par aucun module
   aujourd'hui. Soit on lui donne un contenu, soit on l'enlève.
2. **Prix.** Une association subventionnée raisonne en budget annuel voté, pas
   en abonnement mensuel. Un tarif annuel unique, éventuellement indexé sur le
   budget du lieu, colle mieux à leur réalité — et à leur trésorerie.
3. **La mesure d'audience** (question soulevée le 26/07) : Google Analytics
   tourne sur les sites des clients sous ton compte. Restituée aux lieux, c'est
   une fonctionnalité vendable. Laissée telle quelle, c'est une gêne à expliquer.
4. **Quand referme-t-on la bêta ?** Tant que la date n'est pas posée, l'étape 2
   n'a pas de raison d'être priorisée — et c'est précisément celle qu'il ne faut
   pas faire dans l'urgence.
