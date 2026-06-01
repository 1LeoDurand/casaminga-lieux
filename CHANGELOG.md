# CHANGELOG — Casa Minga Lieux

---

## [v2.8] — 2026-06-01 — Audit complet (branche audit/debug-session-01)

### MODULE 1 — Site public
- **fix:** parallélisation `Promise.all` sur `getPublicSiteBySlug` + `getOrganizationBySlug` (site public ~2× plus rapide)
- **fix:** `org.address` et `org.hours` null → plus d'affichage "null · null", la ligne est masquée si les deux champs sont vides
- **fix(DB):** status campagne `"public"` → `"publie"` en base (aligne DB sur le type TypeScript `MembershipCampaignStatus`)
- **fix(DB):** policies RLS `campaigns_public_read`, `tiers_public_read`, `applications_public_insert` mises à jour → filtrent sur `status = 'publie'` (cohérent avec le reste du code)

### MODULE 2 — Authentification
- **doc([À VALIDER]):** middleware Next.js au mauvais chemin (`proxy.ts` ≠ `middleware.ts`) → sessions non rafraîchies en mode Supabase réel
- **doc([À VALIDER]):** redirect post-login hardcodée sur `bernard-kohn` → non multi-tenant
- **doc([À VALIDER]):** aucune protection des routes `/dashboard/*` côté serveur

### MODULE 3 — Adhésions
- **fix(critical):** `createMembershipCampaign` retournait `boolean` → retourne maintenant `string | null` (l'ID créé) ; `createCampaignAction` retourne `{ ok, id }` ; le wizard utilise l'ID réel (plus de fake `camp-${Date.now()}` → faux ID causait l'échec silencieux de la création des formules sur une nouvelle campagne)
- **fix:** wizard édition — formules existantes pré-chargées dans le step 2 (prop `existingTiers` passée au `CampaignWizard`) ; avant, le step 2 était toujours vide lors d'une édition
- **fix:** `getDemoCampaignBySlug` filtre maintenant par `status === "publie"` → une campagne brouillon n'est plus accessible via le tunnel public en mode démo

### MODULE 4 — Finances
- **fix(minor):** `exportCsv` — remplacement de l'inline type import `import("@/lib/types").Transaction` par le type déjà importé `Transaction`
- **fix(minor):** `BOM = "﻿"` — commentaire ajouté pour expliquer le caractère UTF-8 invisible

### MODULES 5–10 — Événements · Réservations · Communauté · Documents · Gouvernance · Automatisations
- **audit:** aucun bug logique identifié dans les pages et actions
- **doc([À VALIDER]):** `file_url` Documents rendu sans validation du protocole → XSS potentiel (risque faible, accès admin uniquement)

---

## [v2.7] — 2026-06-01 — Correctifs UX/bug session de test personas

### 🔴 Bloquants / Critiques corrigés

- **BUG-001** : Doublons de formules dans le tunnel adhésion — suppression des 4 tiers `ab*` en doublon en DB.
- **UX-001 / UX-030** : Message dev-facing "La programmation publiée depuis le dashboard..." remplacé par texte public neutre ; section Agenda masquée si vide (mobile + desktop).
- **UX-012** : KPI "Revenus du mois" du cockpit hardcodé à 3 840 € — branché sur le calcul réel des recettes du mois courant depuis `transactions`.
- **UX-013** : Tuile "Impayés en attente" non cliquable — branchée sur `segment: "finances"` avec calcul réel depuis `transactions`.
- **UX-014** : Tuile "Documents à signer" non cliquable — branchée sur `segment: "documents"` avec calcul réel depuis `documents` (statut `envoye`).
- **UX-015** : Aucun champ mode de paiement sur les souscriptions — migration DB (`payment_method`, `payment_ref`), mise à jour du type TS et de `MembershipApplicationInput`, select inline dans le drawer Adhésions pour les souscriptions confirmées.
- **UX-017** : Aucun export depuis Finances — bouton "Exporter CSV" côté client (`Blob + URL.createObjectURL`, BOM UTF-8, format compatible Excel).
- **UX-023** : Header sticky public 4 lignes sur mobile (375px) — `min-w-0 truncate` sur le nom d'org, `shrink-0` sur la nav.
- **UX-025** : Scroll de ~1 800 px avant la section "Adhérer" — galerie réduite en 2 colonnes `aspect-video`, hero photo `aspect-video md:aspect-[4/3]`, CTA "Adhérer au lieu" injecté dans le hero sur mobile.

### 🟠 Hauts corrigés

- **UX-004** : Carte campagne sans prix — prix min/max et nombre de formules affichés sous la description ("4 formules · de 1 € à 50 €") ; tiers fetchés par `Promise.all` au SSR.
- **UX-005** : Total invisible en step 1 du tunnel — montant provisoire affiché dynamiquement dans le footer nav dès la sélection formule + don.
- **UX-016** : Bouton "Administrer" trop ambigu — renommé en "Adhérents (N)" avec count confirmés affiché.
- **UX-021** : Bouton "Facture" leading to "bientôt disponible" — remplacé par "Transaction" naviguant vers `/finances`.
- **UX-024** : `text-4xl` non réduit sur mobile — `text-3xl md:text-4xl` sur le h1 hero ; sections `text-xl md:text-2xl`.
- **UX-026** : Header et h1 du tunnel trop grands sur mobile — `truncate min-w-0 text-base` sur le nom org, `text-2xl md:text-3xl` sur le h1 campagne.
- **UX-027** : Pas de scroll-to-top entre étapes du tunnel — `window.scrollTo({ top: 0, behavior: 'smooth' })` ajouté dans les 3 fonctions `nextFrom*`.
- **UX-028** : Perte d'état du tunnel si l'app est mise en arrière-plan — persistance `sessionStorage` (step, tierId, adherent, payer, donation) avec restore au montage et clear à la soumission réussie.
- **UX-029** : Boutons de don trop denses sur 375px — grille `grid-cols-3` pour les montants, champ libre sur sa propre ligne.

### 🟡 Moyens corrigés

- **UX-002** : Placeholders photos avec labels dev-facing — remplacés par des dégradés neutres pêche/crème sans texte.
- **UX-003** : Lien "Espace équipe — administrer ce lieu" public dans le footer — supprimé.
- **UX-006** : Description ambiguë "Adhésion à l'unité" — clarifiée en DB : "Accès à un atelier ou événement · montant minimum, libre au-delà".
- **UX-007** : Icônes action sans tooltip — `title` ajouté sur chaque bouton (Publier/Dépublier, Modifier, Supprimer, Voir le tunnel public).
- **UX-018** : KPI "En attente" Finances non cliquable — cliquable, applique `statF = {"en_attente"}` sur la liste.
- **UX-019** : Bouton "Réinitialiser" ambigu (évoque effacement de données) — renommé "Effacer les filtres".
- **UX-020** : Graphique sans indication de période — libellé période affiché en en-tête de la carte (ex. "mai – juin 2026 · 2 mois").

### 🟢 Faibles corrigés

- **UX-009** : Période non affichée pour les campagnes à année glissante ou illimitée — texte lisible ajouté sur la carte campagne pour tous les `period_type`.
- **UX-010** : Badge DEMO sans explication — `title` tooltip ajouté sur le badge dans la sidebar.
- **UX-022** : Modèle mental Adhésions / Finances découplés — banderole de lien "Voir les adhésions →" ajoutée en haut de la vue Finances.

### 🗄️ Migrations DB

- `v2_6_adhesions_payment_fields` : `payment_method TEXT`, `payment_ref TEXT` sur `membership_applications`.
- `v2_6_tiers_add_updated_at` : colonne `updated_at` ajoutée sur `membership_tiers` (correction trigger `set_updated_at`).

---

## [v2.6] — 2026-05-31 — Module Adhésions

- Module complet façon HelloAsso : tunnel public 4 étapes, backoffice campagnes/formules/souscriptions.
- Migration `v2_6_adhesions` : tables `membership_campaigns`, `membership_tiers`, `membership_applications` + RLS.
- Seed : campagne "Bulletin d'adhésion 2026" (public) + "Coworking 2026" (brouillon) + 4 formules + 4 souscriptions.
- `adhesions` flippé `ready: true` en première position de la section Structure dans `modules.ts`.

---

## [v2.5] — Automatisations

## [v2.4] — Impact

## [v2.3] — Partenaires

## [v2.2] — Gouvernance

## [v2.1] — Communauté

## [v2.0] — Tâches & alertes

## [v1.1] — Formulaire de demande public + route API

## [v1.0] — Scaffold initial
