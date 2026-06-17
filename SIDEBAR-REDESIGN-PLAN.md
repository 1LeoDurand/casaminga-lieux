# Plan — Redesign sidebar « Rail + Panneau » (d'après handoff Claude Design)

> Source : `design_handoff_sidebar/README.md` + `Sidebar - Rail + Panneau.dc.html`.
> Refonte de la navigation latérale du dashboard `/dashboard/[org]`.

## Décisions
- **Police** : on garde `font-heading` (Poppins) déjà en place. Pas d'intro de Syne (changement
  global hors scope). Tokens couleurs : rail `#222323`, panneau `#2C2D2D`, coral `var(--coral)`.
- **Routes** : inchangées — on ne fait que **regrouper** visuellement. « Structure » (11 items)
  éclatée en **Finances** (6) + **Administration** (5). Les `segment` restent identiques.
- **Réutilisation** : `.mc-nav-item` pour les items panneau/flyout/mobile. Rail + structure =
  Tailwind utilities (pas de style inline brut).

## Nouvelle arborescence (6 sections)
| key | short | icône section | items (key → segment) |
|---|---|---|---|
| pilotage | Pilotage | `Gauge` | dashboard·/ , demandes, personnes, taches |
| lieu | Lieu | `Building2` | espaces, residences, evenements, inventaire |
| finances | Finances | `ChartPie` | finances, factures, depenses, subventions, dons, caisse |
| admin | Admin | `Folder` | adhesions, contrats, documents, gouvernance, impact |
| comm | Comm. | `Megaphone` | site-public, domaine(upgrade), communication |
| systeme | Système | `Settings` | automatisations, equipe, parametres |

## Fichiers à modifier
1. **`src/lib/modules.ts`** — ajouter à `ModuleSection` : `key`, `shortLabel`, `icon` (nom lucide).
   Resplit Structure → Finances + Administration. Ré-aligner les icônes par item au mapping handoff.
   (Additif + regroupement : SOCLE_KEYS et moduleLabelForSegment restent valides.)
2. **`src/components/mc/dashboard-sidebar.tsx`** — réécriture complète :
   - **Desktop ≥lg** : rail 88px (logo, 6 sections icône+label court, toggle bas, avatar) +
     panneau 212px (titre section coral + « N écrans » + items). Replié → panneau caché,
     clic section = **flyout flottant** (`absolute left-88`) refermé après choix.
   - Surlignage **coral plein** de la section contenant l'écran actif (même replié).
   - **Mobile <lg** : barre d'onglets bas (Tableau · Demandes · Personnes · Menu) + tiroir
     2 niveaux (Favoris + Sections → détail).
   - État local : `pinnedSection`, `flyout`, `mobileView('sections'|'detail')`, `mobileSection`.
     `collapsed`/`mobileOpen` viennent de `useSidebar()`. Section active déduite du `usePathname`.
3. **`src/components/mc/dashboard-shell.tsx`** — largeur grille desktop : `300px` déployé /
   `88px` replié (au lieu de 232/72). La sidebar gère elle-même drawer mobile + tab bar
   (fixed) ; le shell garde le contexte + topbar + main. `main` : `pb` mobile pour la tab bar.
4. **`src/app/globals.css`** — au besoin, classes rail (`cm-rail-btn`) ; sinon Tailwind inline.
   Nettoyer les règles `.cm-sidebar[data-collapsed]` devenues caduques.

## Persistance & interactions
- `collapsed` persisté (localStorage, déjà géré par le shell).
- Clic section déployé → épingle (`pinnedSection`). Replié → toggle flyout. Clic item → navigue
  (Link) ; en replié ferme le flyout. Toggle bas du rail → `toggleCollapsed`.
- Mobile : tab bar toujours visible ; « Menu » ouvre le tiroir niveau sections ; tap section →
  détail ; tap écran → navigue + ferme.

## Vérification
1. `tsc`/`next build` propre (avec plafond 1536 = prod).
2. Vérif visuelle locale en **mode démo** (Supabase env vidé → layout sans auth) : `next start`,
   charger le dashboard démo, screenshot rail+panneau + replié + mobile.
3. Garder routes réelles (cliquer = bonne page). Commit (sans push).
