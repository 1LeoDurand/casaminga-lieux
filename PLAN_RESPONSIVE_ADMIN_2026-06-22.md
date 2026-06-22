# Plan — Responsive de l'espace admin (handoff Opus → Sonnet, 2026-06-22)

> **Ticket** : « Responsive espace admin : rendre tout le dashboard utilisable sur
> mobile/tablette (sidebar, tableaux, formulaires, modales) ».
> **Repo** : `casa-minga-lieux` (branche `main`). **Commiter librement, NE JAMAIS
> pusher sans que Léo dise « push ».** `npx tsc --noEmit` doit passer avant commit.
> **Tester** chaque écran à **375 px** (mobile) ET **768 px** (tablette).

---

## État des lieux (constaté dans le code, pas supposé)

| Brique | État réel | Conséquence mobile |
|---|---|---|
| **Coquille** (`dashboard-shell.tsx`, `dashboard-sidebar.tsx`) | Sidebar off-canvas + barre d'onglets mobile DÉJÀ en place | ✅ navigation OK — ne rien casser |
| **Tables `.mc-table`** (9 vues) | Toutes wrappées dans `.mc-table-wrap` = `overflow-x:auto` (`globals.css:512`) | ⚠️ elles **scrollent** horizontalement (pas de débordement), mais UX médiocre au doigt |
| **Liste Factures** (`invoices-view.tsx`) | ✅ **déjà responsive** : cartes mobile + `<table table-fixed>` desktop (commit `d4056a8`) | **= PATRON DE RÉFÉRENCE à copier** |
| **Formulaires** (`event-form`, `invoice-editor`, `cash-register`…) | `grid grid-cols-2` / `grid-cols-[1fr_auto]` **sans** préfixe `md:` | ❌ 2 colonnes forcées même à 375 px → champs écrasés |
| **Modales** (~13 `fixed inset-0` + `max-w-…`) | largeur fixe, pas toujours de `max-h`/scroll | ⚠️ peut dépasser l'écran, contenu coupé |

**Conclusion stratégique** : la priorité n'est PAS les tables (elles scrollent déjà) mais
**(1) les formulaires/modales** (cassent vraiment) puis **(2) l'UX des tables denses les
plus utilisées** (passer du scroll horizontal aux cartes, façon Factures).

---

## PHASE 1 — Fondations larges, peu risquées (faire en premier)

### 1a · Formulaires : dégrader les grilles à 1 colonne sur mobile
**Règle** : tout `grid grid-cols-2` ou `grid-cols-[1fr_auto]` d'un **formulaire** →
`grid-cols-1 sm:grid-cols-2` (ou `sm:grid-cols-[1fr_auto]`).
**Fichiers prioritaires** (lignes indicatives, à reconfirmer) :
- `event-form.tsx` : lignes 116, 150, 167, 180 (`grid grid-cols-2`, `grid-cols-[1fr_auto]`).
- `invoice-editor.tsx` : 5 occurrences de grilles 2-col / `[1fr_auto]`.
- `cash-register-view.tsx`, `transaction-form.tsx`, `space-form.tsx`,
  `reservation-form.tsx`, `person-form.tsx`, `residence-form.tsx`, `task-form.tsx`,
  `document-form.tsx` → même règle, balayer chaque `grid-cols-2` de saisie.
> ⚠️ NE PAS toucher les grilles d'**affichage** (KPIs `grid-cols-2 lg:grid-cols-4`) qui
> sont volontairement 2-col sur mobile et OK. Cibler uniquement les **champs de saisie**.

**Critère** : à 375 px, chaque formulaire empile ses champs sur une colonne, rien n'est
écrasé ; à ≥ 640 px on retrouve 2 colonnes.

### 1b · Modales : plafonner la hauteur + scroll interne + padding mobile
**Règle** sur chaque conteneur de modale (`fixed inset-0 … flex items-center justify-center`):
- panneau : ajouter `max-h-[90vh] overflow-y-auto` + `w-full` + `mx-4` (au lieu d'une
  largeur fixe sèche) ; garder `max-w-…` pour le desktop.
- voile : `p-4` pour que la modale ne colle pas aux bords.
**Fichiers** (13 repérés via `fixed inset-0`) — prioriser ceux à formulaire :
`invoices-view.tsx` (modale paiement, déjà OK à vérifier), `cash-register-view.tsx`,
`groups-manager.tsx`, `coworking-view.tsx`, `artists-view.tsx`, `grants-view.tsx`,
`veille-view.tsx`, `newsletter-composer.tsx`, `team-view.tsx`. (Les widgets
`help-widget`/`feedback-widget` sont des bulles, traitement à part.)

**Critère** : à 375 px, toute modale tient dans l'écran, scrolle si trop longue, garde une
marge sur les bords ; boutons d'action atteignables.

### 1c · Affordance de scroll des tables (quick win global)
Tant que les tables denses ne sont pas passées en cartes (Phase 2), améliorer
`.mc-table-wrap` dans `globals.css:512` : ajouter un dégradé/ombre de bord indiquant qu'on
peut scroller horizontalement (ex. `background` masque + `-webkit-overflow-scrolling: touch`).
**Critère** : sur mobile, on voit qu'il y a du contenu à droite et le scroll est fluide.

---

## PHASE 2 — Tables denses → cartes mobile (patron Factures, écran par écran)

**Patron de référence = `invoices-view.tsx`** (commit `d4056a8`) :
`<ul className="divide-y md:hidden">` (cartes) **+** `<table table-fixed md:table>` (desktop),
logique partagée factorisée dans une fonction `rowParts()`.

**Ordre proposé** (à valider avec Léo — par fréquence d'usage) :
1. **Personnes** — `persons-view.tsx` (table `mc-table` ligne ~450). Très consulté.
2. **Événements** — `events-view.tsx` (table ligne ~293).
3. **Caisse** — `cash-register-view.tsx` (table + saisie + modale → gros morceau).
4. **Réservations** — `reservations-view.tsx`.
5. **Finances** — `finances-view.tsx` (déjà 1 amorce responsive).
6. **Dépenses** — `expenses-view.tsx` ; **Dons** — `dons-view.tsx`.
Puis le reste au fil de l'eau : `gouvernance-view`, `documents-view`, `residences-view`,
`spaces-view`, `tax-receipts-view`, `requests-view`, `contracts-view`, `grants-view`,
`inventory-view`, `artists-view`.

**Méthode par écran** :
1. Lire la vue, repérer le `<table className="mc-table">` (dans `.mc-table-wrap`).
2. Garder la table pour `md:` (`hidden md:block` sur le wrap, ou `md:table`).
3. Ajouter au-dessus un `<ul className="… md:hidden">` qui mappe les mêmes données en
   cartes (numéro/nom en gras, méta en petit, badges + actions en bas) — calquer Factures.
4. Factoriser la logique commune (badges, boutons) dans un helper local si dupliquée.
5. Vérifier 375 px + 768 px.

**Critère global Phase 2** : sur les écrans traités, plus aucun scroll horizontal au doigt ;
chaque ligne devient une carte lisible et actionnable.

---

## PHASE 3 — Finitions
- En-têtes de page / barres d'actions (`page-header.tsx`, `dashboard-quickbar.tsx`) :
  `flex-wrap`, boutons qui passent à la ligne, titres qui ne débordent pas.
- KPIs (`kpi-tile.tsx`) : vérifier le wrap à 2-col mobile.
- Détails facture (`invoice-detail.tsx`) et éditeurs longs : padding + scroll mobile.

---

## Récap & garde-fous
- ✅ **Sidebar/navigation déjà responsive** — ne rien régresser.
- ⚠️ Distinguer grilles de **saisie** (à dégrader 1-col) des grilles d'**affichage KPI**
  (à laisser).
- Le **patron Factures** (`invoices-view.tsx`, commit `d4056a8`) est la référence unique à
  copier pour toute table.
- Avancer **par lot d'écrans**, tester à 375/768, commiter par écran, **ne pas pusher**
  sans ordre. Voir [PLAN_SONNET_2026-06-22.md] (Lot C y renvoie).
