# Plan d'exécution — handoff Opus → Sonnet (2026-06-22)

> **But** : Léo passe en Sonnet pour exécuter. Chaque item donne fichier:ligne,
> diagnostic, le changement exact et le critère d'acceptation. Faire dans l'ordre.
>
> **Repo** : `casa-minga-lieux` (admin, branche `main`). Sauf A-1 qui touche
> aussi l'accueil public servi par la même app.
> **Avant push** : `npx tsc --noEmit` doit passer. **Ne JAMAIS pusher sans que
> Léo dise « push »** (commiter librement). Déploiement = SSH `git pull && npm run build`.
> **Vérifier** chaque fix dans le navigateur (preview) avant de cocher.

---

## LOT A — Quick fixes (exécutables tout de suite)

### A-1 · CTA « inscription » sur l'accueil  ✅ wording validé par Léo
**Fichier** : `src/app/(admin)/page.tsx` — Panel 7 « Parlons-en », lignes ~653-672.
**Constat** : le panneau final n'a QU'UN bouton « Voir la démo → » (`/dashboard/test`).
Le vrai CTA gestionnaire (créer son espace) manque. Décision Léo : **inscription en
principal, démo en secondaire** (le produit est gratuit → friction nulle ; la démo
rassure mais ne capte pas le lead).

**Changement** : dans le `<div>` des boutons (ligne ~660), AJOUTER un bouton primaire
AVANT le bouton démo existant :
- **Primaire** (corail plein, `background: ACCENT`, texte `#FFF9EC`) :
  « Créer mon espace gratuit → » → `href="/signup"`.
- **Secondaire** = garder le bouton démo actuel mais le passer en style outline/sombre
  secondaire (il est déjà sombre `#2C2D2D`, OK de le garder tel quel à droite du primaire).
- Sous-ligne de réassurance à côté/dessous : **« Gratuit · sans carte bancaire · votre
  lieu en ligne en 5 minutes »** (garder aussi la mention démo existante).

> Optionnel (bonus) : ajouter le même duo de boutons dans le hero (après la tagline
> « un lieu à la fois », ligne ~417) pour un CTA au-dessus de la ligne de flottaison.

**Acceptation** : depuis l'accueil, un bouton corail « Créer mon espace gratuit » mène à
`/signup` ; la démo reste accessible en secondaire ; réassurance visible.

---

### A-2 · Logo de la sidebar trop lourd (perf)  — ticket bug
**Fichiers** : `src/components/mc/dashboard-sidebar.tsx` lignes **309** (rail desktop) et
**406** (header mobile) → `<img src="/logo.png" … className="size-9 …" />`.
**Diagnostic CONFIRMÉ** : `public/logo.png` pèse **~1 Mo** (1 015 756 o) et est affiché en
36 px. Idem `public/logo-blanc.png` (~1,29 Mo) et `logo-maloka.png` (~2,3 Mo). `logo.png`
est aussi chargé sur `/signup`, `/onboarding`, login et pages légales → **gain global**.

**Changement** :
1. Générer une version optimisée **`public/logo-icon.webp`** (et/ou `.png`) à ~96×96 px,
   compressée (cible < 15 Ko). Méthode : `sharp` est déjà une dépendance Next —
   `node -e "require('sharp')('public/logo.png').resize(96,96).webp({quality:82}).toFile('public/logo-icon.webp')"`.
   (Fallback si sharp indispo : exporter à la main depuis l'original Drive.)
2. Pointer les `<img>` sidebar (309, 406) sur `/logo-icon.webp` + ajouter `width={36}
   height={36}` (évite le reflow) et `loading="eager"` (logo = above the fold).
3. Recenser les autres usages de `/logo.png` (signup/onboarding/légales/login) et basculer
   sur la version légère là où c'est une petite icône (garder l'original uniquement si
   réellement affiché en grand quelque part).

**Acceptation** : le logo s'affiche instantanément (transfert < 20 Ko en onglet Réseau),
plus de latence visible au chargement du dashboard.

---

### A-3 · Flyout sidebar repliée passe DERRIÈRE les cartes (z-index)  — ticket bug
**Fichier** : `src/components/mc/dashboard-sidebar.tsx` ligne **383-397** (le flyout
flottant rendu quand `collapsed && flyoutSection`).
**Diagnostic** : le flyout est `position: fixed … z-[60]`. Il s'ouvre au clic d'une section
quand la sidebar est repliée. Il passe sous des éléments du tableau de bord (cartes
événements / « Premiers pas »). Le menu utilisateur du rail est lui en `z-[70]` (au-dessus),
preuve que `z-[60]` est trop bas. Le conteneur racine du shell
(`dashboard-shell.tsx:80`) est `overflow-hidden` mais ne piège PAS le `fixed` (pas de
`transform` sur desktop — `dashboard-shell.tsx:89` force `lg:!transform-none`).

**Changement** :
1. Monter le flyout à **`z-[80]`** (au-dessus de la topbar `z-50`, du voile mobile `z-40`,
   et du menu user `z-70`) — ligne 385.
2. Reproduire (replier la sidebar via le chevron, cliquer une section par-dessus le
   dashboard). Si une carte reste au-dessus, AUDITER les `z-[…]` positifs des widgets du
   dashboard (`grep -rn "z-\[" src/app/(admin)/dashboard src/components/mc` sur les
   composants événements/réservations/onboarding) et baisser tout z-index ≥ 80 superflu,
   ou créer un seul niveau cohérent. Vérifier aussi qu'aucun ancêtre de ces cartes n'a un
   `transform`/`filter`/`will-change` qui crée un contexte d'empilement parasite.

**Acceptation** : sidebar repliée, le flyout d'une section s'affiche AU-DESSUS de tout le
contenu du dashboard, cliquable entièrement.

---

### A-4 · H2 — Alignement de la liste des factures (fix précédent INSUFFISANT)
**Fichier** : `src/components/mc/invoices-view.tsx` — en-tête desktop **ligne 211** et
chaque ligne **ligne 306**.
**Diagnostic (la vraie cause)** : l'en-tête ET chaque ligne sont des **grilles SÉPARÉES**
partageant le template `grid-cols-[1.1fr_1.3fr_0.9fr_0.9fr_1fr_0.8fr_auto]`. Comme les
tracks `fr` et surtout `auto` (dernière colonne = boutons d'action) se résolvent
INDÉPENDAMMENT par grille selon leur contenu, les colonnes ne s'alignent pas d'une ligne à
l'autre, ni avec l'en-tête (dont la dernière colonne `auto` vaut 0 car vide). Le nombre de
boutons varie (1 à 5 selon le statut) → décalage visible (cf. capture Léo).

**Changement (fix déterministe, diff minimal)** — appliquer aux DEUX templates (211 et 306) :
1. Remplacer chaque `Nfr` par **`minmax(0,Nfr)`** (empêche le `min-content` du texte
   `truncate` d'élargir un track → colonnes égales d'une ligne à l'autre).
2. Remplacer le dernier **`auto`** par une **largeur fixe** suffisante pour 5 boutons,
   p.ex. `220px` (identique en-tête + lignes). Résultat : même espace libre distribué
   partout → alignement parfait.
   → Template final : `grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)_220px]`.
3. Vérifier que la colonne montant et la colonne règlement restent lisibles ; ajuster les
   `fr` si besoin (garder l'en-tête et les lignes STRICTEMENT identiques).

> **Alternative robuste** (si on veut le « canonique ») : passer la liste desktop en
> `<table className="w-full table-fixed">` + `<colgroup>` avec largeurs explicites —
> `table-fixed` rend les colonnes indépendantes du contenu par construction. Plus de
> travail (refonte du markup), mais c'est la solution propre de référence.

**Acceptation** : en-tête et toutes les lignes parfaitement alignés colonne par colonne,
quel que soit le nombre de boutons d'action. **Vérifier dans le navigateur** sur la vraie
liste de Bernard Kohn (la capture montrait le défaut) avant de clôturer le ticket H2.

---

### A-5 · B1 — Newsletter : impossible de scroller pour « Enregistrer » après « ajouter un bloc »
**Fichier** : `src/components/mc/newsletter-editor.tsx` — `AddBlockMenu` **ligne 459**,
barre d'actions `sticky bottom-4` **ligne 481** (contient « Enregistrer »).
**Diagnostic probable** : la barre d'actions flottante (`sticky bottom-4`, ombre) reste
collée en bas du conteneur de scroll (`<main>` de `dashboard-shell.tsx:108`). Quand on
ouvre `AddBlockMenu` / qu'on ajoute un bloc en bas de liste, le dernier bloc et/ou le menu
déroulant passent **sous** la barre flottante, et il n'y a pas assez de marge basse pour
scroller au-delà → « on ne peut plus atteindre Enregistrer ».
**À reproduire d'abord** (ouvrir une newsletter brouillon → Ajouter un bloc plusieurs fois).

**Changements candidats** (appliquer ce que la repro confirme) :
1. Ajouter une **marge basse** au conteneur des blocs (le `<div className="flex flex-col
   gap-3">` ligne 442, ou son parent scrollable) — p.ex. `pb-28` — pour que le dernier
   bloc + `AddBlockMenu` dégagent la barre flottante.
2. S'assurer que le **dropdown de `AddBlockMenu`** s'affiche AU-DESSUS de la barre sticky
   (z-index supérieur) ou s'ouvre vers le haut s'il n'y a pas de place dessous.
3. Vérifier qu'aucun verrou de scroll (`body overflow hidden`) n'est posé à l'ouverture
   du menu.

**Acceptation** : on peut ajouter plusieurs blocs et toujours scroller jusqu'à
« Enregistrer » / « Envoyer », sur desktop ET mobile.

---

## LOT B — Tickets « H » à planifier (features, specs plus légères)

### H1 · Factures antérieures (reprise d'historique)  — amélioration, prio haute
**Besoin** : à la création d'un compte, pouvoir saisir des factures du PASSÉ (date
d'émission antérieure). Aujourd'hui impossible.
**Pistes** : (a) autoriser une `issue_date` passée dans l'éditeur de facture
(`invoice-editor.tsx`) ; (b) ⚠️ la numérotation est continue/atomique
(`assign_invoice_number`) — pour l'historique, prévoir soit une **référence libre**
(champ texte séparé du numéro auto) soit un **numéro de départ** paramétrable par org.
Cf. roadmap « Numérotation flexible ». À cadrer avec Léo avant code (impact légal/compteur).

### H3 · Personnes : qui a accès au logiciel + reset mot de passe  — prio haute
**Besoin** : (1) dans « Personnes », voir facilement qui a un accès au logiciel (colonne /
badge), façon WordPress « Password Reset » ; (2) bouton **« Envoyer un lien de
réinitialisation de mot de passe »** ; (3) **BUG** : Jacques Bourely a bien un compte mais
l'UI affiche « Pas d'accès au logiciel » → vérifier la jointure compte↔personne (`user_id`
/ email) qui détermine le statut d'accès. Fichiers : `members-access-list.tsx`,
`person-access-panel.tsx` (déjà présents). Reset = `supabase.auth.resetPasswordForEmail`
via une server action gardée admin.

### H5 · Modération de la publication des sites publics (/admin)  — prio haute
**Besoin** : dans `/admin`, Léo veut **accepter ou refuser** la publication d'un site et son
affichage sur `casaminga.com`. Aujourd'hui `public_sites.status` (brouillon|publie) est
piloté par le lieu lui-même. Piste : ajouter un état de **modération** (p.ex.
`moderation_status` en attente|approuvé|refusé) contrôlé par le super-admin, et ne servir
sur `casaminga.com/<slug>` que les sites `publie` ET `approuvé`. ⚠️ se coordonne avec le
chantier belle URL déjà livré (le SPA lit `status='publie'` — ajouter le filtre modération
côté requête `fetchLieuBySlug` ET côté admin `/site/[slug]`).

---

## LOT C — Gros chantier : Responsive de l'espace admin  — nouveau ticket, prio haute
> 📄 **Plan détaillé écran par écran : [PLAN_RESPONSIVE_ADMIN_2026-06-22.md](PLAN_RESPONSIVE_ADMIN_2026-06-22.md)**
> (phases formulaires/modales → tables en cartes ; patron = `invoices-view.tsx` commit `d4056a8`).

**Besoin Léo (22/06)** : rendre tout `admin.casaminga.com/dashboard` confortable sur
mobile/tablette (aujourd'hui pensé desktop).
**État** : la coquille a DÉJÀ des fondations responsive (sidebar off-canvas + tab bar
mobile dans `dashboard-shell.tsx` / `dashboard-sidebar.tsx`). Le travail = passer en revue
**écran par écran** les contenus :
- Tableaux denses (factures, personnes, événements, caisse, dépenses…) → vues carte mobile
  comme celle déjà faite dans `invoices-view.tsx` (md:hidden / hidden md:grid).
- Formulaires & modales (largeurs fixes, `max-w`, grids 2 colonnes) → empilage mobile.
- KPIs et en-têtes → wrap.
**Méthode** : chantier dédié, écran par écran, tester à 375 px et 768 px. À cadrer en lot
séparé (ordre de priorité des écrans avec Léo : sûrement Factures, Personnes, Événements,
Caisse en premier).

---

## Récap tickets (table `feedback`)
- **A-2 logo perf** + **A-3 z-index flyout** : ajoutés (accepted).
- **H2** : RÉOUVERT (fix précédent insuffisant) — note pointant ici (A-4).
- **H4** (lien public casaminga.com) : ✅ OK (chantier belle URL) — à clôturer après déploiement FTP.
- **Responsive admin** : ajouté (accepted, prio haute) → Lot C.
- B1, H1, H3, H5 : déjà en base, cf. lots ci-dessus.
