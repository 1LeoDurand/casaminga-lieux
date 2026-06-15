# Specs — 3 nouveaux modules (Lots 15 · 16 · 17)

> **✅ IMPLÉMENTÉS (2026-06-15).** Les 3 modules sont codés en chaîne complète (migrations Supabase
> appliquées, types, vues admin, actions, entrées `modules.ts` + archétypes). `tsc` + `next build`
> verts. Détail des chaînes livrées en fin de document.

> Issus de l'audit du Drive réel d'un tiers-lieu (« Tiers-lieu Bernard Kohn »), dont
> l'arborescence `00 → 12` cartographie les besoins prouvés par l'usage. Ces 3 modules
> comblent les dossiers qui contiennent des **opérations structurées** (états, échéances,
> relations) et non du simple stockage de fichiers.

## Conventions communes (rappel, à respecter pour les 3)

- Table scopée `organization_id uuid NOT NULL`, `id uuid default gen_random_uuid()`,
  `created_at timestamptz default now()`, `updated_at timestamptz`.
- RLS : `<table>_select` → `using (is_org_member(organization_id))` ;
  `<table>_write` (ALL) → `using (is_org_admin(organization_id))`.
- Montants en `numeric`, dates en `date`.
- `pole_id uuid` nullable (FK `poles`) pour classification par pôle.
- Personnes liées via `<role>_person_id uuid` nullable (FK `persons`).
- Enregistrement dans [`src/lib/modules.ts`](../src/lib/modules.ts) (`key, label, segment, layer,
  tableKey, minTier`) → la sidebar + l'auto-détection (`tableKey` ≥1 ligne ⇒ activé) sont gratuites.
- Pré-activation par archétype dans `ORG_ARCHETYPES`.
- Page serveur `export const dynamic = "force-dynamic"`, `await params`, `getOrganizationBySlug`,
  `notFound()`. Vue cliente : liste/cartes + drawer (`mc-drawer`) + modale formulaire,
  pattern identique à `expenses-view.tsx` / `grants` / `gouvernance-view.tsx`.
- Échéances → branchées sur **Tâches & alertes** (module `taches` existant).

---

## Lot 15 — 📦 Inventaire & Matériel  `segment: inventaire`

**Couvre les dossiers Drive** : `03·C Mobilier & inventaire`, `03·E Scanner / matériel info`,
`03·B Travaux & maintenance`.

**Problème résolu** : « qu'est-ce qu'on possède, où, dans quel état, qui l'a en ce moment » +
suivi des pannes/maintenance. Aucun équivalent aujourd'hui — trou net.

### Données

**Table `assets`** (le bien)

| colonne | type | notes |
|---|---|---|
| `name` | text NOT NULL | désignation |
| `category` | text | mobilier · informatique · son · lumière · cuisine · outillage · autre |
| `reference` | text null | n° de série / inventaire |
| `location` | text null | où dans le lieu (salle, atelier…) |
| `pole_id` | uuid null | pôle propriétaire |
| `holder_person_id` | uuid null | qui l'a actuellement (prêt en cours) |
| `status` | text | `disponible` · `en_pret` · `en_panne` · `maintenance` · `reforme` |
| `condition` | text | `neuf` · `bon` · `use` · `hs` |
| `quantity` | int default 1 | |
| `purchase_date` | date null | |
| `purchase_value` | numeric null | pour la valeur totale du parc |
| `warranty_until` | date null | **→ alerte garantie** |
| `photo_url` | text null | bucket `public-assets` |
| `notes` | text null | |

**Table `asset_maintenance`** (tickets — P2, peut suivre en v1.1)

| colonne | type | notes |
|---|---|---|
| `asset_id` | uuid null | null = travaux général du lieu, pas un bien précis |
| `title` / `description` | text | |
| `status` | text | `a_faire` · `en_cours` · `fait` |
| `reported_at` / `due_date` / `done_at` | date | `due_date` **→ alerte** |
| `cost` | numeric null | **→ peut générer une Dépense** |
| `assignee_person_id` | uuid null | |

### Branchements
- `holder_person_id` → **Personnes** (prêt/retour, historique).
- `pole_id` → **Pôles**.
- `warranty_until` + `due_date` → **Tâches/alertes** (garanties & maintenances à échéance).
- `asset_maintenance.cost` → **Dépenses** (bouton « Créer la dépense » depuis un ticket).
- `photo_url` → bucket `public-assets` (déjà accepté).

### Vues
- Liste/cartes filtrables (catégorie / statut / lieu / pôle).
- Drawer bien : fiche, photo, **bouton « Prêter à… » / « Retour »** (set `holder_person_id` + statut),
  historique de prêt, tickets de maintenance liés.
- Onglet **Maintenance** : tickets à faire / en cours.
- KPIs : nb de biens · valeur totale du parc · en panne · garanties expirant < 30 j.

### Archétypes pré-activant : `tiers-lieu`, `coworking`, `culturel`, `residence`.
### Effort : **moyen** (2 tables, logique prêt/retour). `minTier: "complete"`, `layer: 2`.

---

## Lot 16 — 💝 Dons & mécénat  `segment: dons`

**Couvre le dossier Drive** : `01·F Dons & mécénat`.

**Problème résolu** : le **3ᵉ pilier de financement** d'une asso (Subventions = public,
Adhésions = cotisations, **Dons = mécénat/générosité**) n'a pas de maison. **Réutilise le reçu
fiscal Cerfa déjà codé (Lot 6)** et le pattern recette-auto (facture→Finances).

### Données

**Table `donations`** (les dons reçus)

| colonne | type | notes |
|---|---|---|
| `donor_name` | text NOT NULL | |
| `donor_person_id` | uuid null | lien CRM |
| `donor_email` / `donor_address` | text null | requis pour le Cerfa |
| `amount` | numeric NOT NULL | |
| `donation_type` | text | `ponctuel` · `recurrent` · `nature` · `mecenat` |
| `received_at` | date NOT NULL | |
| `payment_method` | text null | |
| `campaign_id` | uuid null | |
| `pole_id` | uuid null | |
| `tax_receipt_issued` | bool default false | reçu Cerfa émis ? |
| `tax_receipt_ref` | text null | n° du reçu généré |
| `notes` | text null | |

**Table `donation_campaigns`** (appels aux dons — optionnel, calque `membership_campaigns`)

| colonne | type | notes |
|---|---|---|
| `title` / `description` | text | |
| `goal_amount` | numeric null | objectif (jauge) |
| `start_date` / `end_date` | date null | |
| `status` | text | `brouillon` · `active` · `terminee` |
| `is_public` | bool | visible sur `/site/[slug]/soutenir` (page existante) |

### Branchements
- `amount` + `received_at` → **Finances** : recette auto (libellé « Don de … », bon pôle),
  **exactement le câblage facture→Finances déjà validé en QA**.
- Bouton **« Générer reçu fiscal »** → réutilise `tax-receipts-view` / `factures/recus/` (Lot 6).
  Bonus : **reçu annuel groupé** (un donateur, N dons sur l'année → un seul Cerfa).
- `donor_person_id` → **Personnes** (un donateur = une fiche CRM).
- `campaign_id` + `is_public` → bloc **« Soutenir »** du site public (déjà en place).
- `donation_type = recurrent` → **Tâches/alertes** (relance des dons récurrents).

### Vues
- Liste des dons (filtres type / campagne / pôle / année).
- Drawer don : donateur, **« Générer reçu Cerfa »**, lien fiche personne.
- Onglet **Campagnes** : objectif vs collecté (jauge), public/privé.
- KPIs : total collecté (année) · nb donateurs · dons récurrents · reçus à émettre.

### Archétypes pré-activant : `association`, `tiers-lieu`, `culturel`.
### Effort : **moyen-faible** (Cerfa + recette-auto + page Soutenir déjà là → surtout du câblage). `minTier: "complete"`, `layer: 2`.

---

## Lot 17 — 📑 Contrats & échéances  `segment: contrats`

**Couvre les dossiers Drive** : `00·B Assurances & contrats`, `04·B Contrats & conventions`,
`02·B Fiches missions & contrats`, et en bonus `01·G Loyer & charges fixes`.

**Problème résolu** : la **signature existe (Lot 9)** mais rien ne suit le **portefeuille** :
quels contrats actifs, quelle assurance expire quand, quel préavis de bail donner avant quelle
date. C'est un registre + un moteur d'**échéances/alertes**. Valeur « tranquillité d'esprit ».

### Données

**Table `contracts`**

| colonne | type | notes |
|---|---|---|
| `title` | text NOT NULL | |
| `contract_type` | text | `assurance` · `bail` · `convention` · `prestation` · `mission` · `partenariat` · `abonnement` · `autre` |
| `counterparty_name` | text | l'autre partie |
| `counterparty_person_id` | uuid null | lien CRM / Partenaires |
| `pole_id` | uuid null | |
| `amount` | numeric null | montant |
| `amount_period` | text | `mensuel` · `annuel` · `ponctuel` (→ charges fixes) |
| `start_date` / `end_date` | date null | |
| `renewal_date` | date null | **échéance clé → alerte** |
| `auto_renew` | bool | tacite reconduction |
| `notice_period_days` | int null | préavis ; alerte = `renewal_date − notice_period_days` |
| `status` | text | `brouillon` · `en_negociation` · `actif` · `expire` · `resilie` |
| `document_id` | uuid null | lien **Documents** (le PDF) |
| `signed` | bool | signé via Lot 9 ? |
| `notes` | text null | |

### Branchements
- `renewal_date` / `end_date` / `(renewal_date − notice_period_days)` → **Tâches/alertes** :
  le cœur de valeur (« assurance expire dans 30 j », « préavis bail à donner avant le X »).
- `document_id` → **Documents** + **signature électronique** (bouton « Envoyer à signer », Lot 9).
- `amount` + `amount_period` → vue **charges fixes prévisionnelles** (couvre `01·G` en bonus).
- `counterparty_person_id` → **Personnes / Partenaires**.

### Vues
- Liste triée par **échéance la plus proche** (filtres type / statut / pôle).
- Bandeau haut **« Échéances à venir »** (< 60 j : renouvellements + préavis).
- Drawer contrat : détails, échéances, document lié, statut signature, « Envoyer à signer ».
- KPIs : contrats actifs · charges fixes annuelles totales · échéances < 30 j · à renouveler.

### Archétypes pré-activant : `tiers-lieu`, `coworking`, `association`.
### Effort : **faible-moyen** (1 table ; valeur = échéances→Tâches, déjà là ; signature déjà là). `minTier: "complete"`, `layer: 2`.

---

## Ordre de réalisation conseillé

1. **Lot 16 — Dons** : meilleur ratio valeur/effort (Cerfa + recette-auto + page Soutenir déjà
   construits), complète le triptyque financement. Impact immédiat pour toute asso.
2. **Lot 17 — Contrats & échéances** : peu de code, forte valeur « sérénité », et couvre 4
   dossiers Drive d'un coup (assurances, conventions, missions, charges fixes).
3. **Lot 15 — Inventaire** : le plus de code (2 tables + prêt/retour + maintenance), cible
   surtout les lieux physiques. À faire quand les deux premiers tournent.

## Hors scope (rappel : ne PAS transformer en modules)
`00·A Statuts`, `Règlement intérieur`, `05 Archives`, `10 Photos`, `11 Vidéos` → **Documents**.
`02·E Planning de présence` / `04·D Planning des postes` → feature **Réservations Espaces** (déjà codée).
`01·A Budget prévisionnel` → feature **Finances** (prévu vs réalisé), pas un module.

---

## ✅ Chaînes livrées (2026-06-15)

### Lot 16 — Dons & mécénat
- **Public** : formulaire de don sur `/site/[slug]/soutenir` (montants suggérés + libre, calcul
  réduction 66 %). `submitPublicDonation` (service-role) → enregistre le don + rattache/crée la
  fiche donateur (tag « donateur »).
- **Paiement** : si Stripe Connect actif → Checkout (`createCheckoutSession` générique,
  metadata `donation_id`), confirmé par le **webhook** (don → `confirme` + recette auto).
  Sinon → promesse de don, équipe notifiée par email.
- **Finances** : don confirmé → transaction `recette` (lien `transactions.donation_id`, calque
  facture→Finances ; suppression auto si don supprimé).
- **CRM** : donateur = fiche `persons` (tag « donateur »), réutilisée par email.
- **Communication** : mail groupé aux donateurs (`sendDonorsEmail`, tous / par campagne).
- **Fiscal** : bouton « Reçu fiscal » → `issueDonationReceipt` crée un **vrai reçu Cerfa
  numéroté** (`tax_receipts` + RPC, système Lot 6) et **ouvre le PDF**
  (`/dashboard/[org]/factures/recus/[id]/pdf`). Mapping mode de règlement → type Cerfa.
- **Campagnes** : objectif vs collecté (jauge), visibilité site public.
- Fichiers : `donations-meta.ts`, `dons/{page,actions}.tsx`, `dons-view.tsx`,
  `soutenir/actions.ts`, `public-donation-form.tsx`, webhook + `stripe.ts` étendus.
- **Seam restant** : paiement carte en ligne — en attente activation Stripe par Léo (Lot 10.1) ;
  d'ici là le don public est enregistré comme promesse + équipe notifiée.

### Lot 17 — Contrats & échéances
- **Registre** : `contracts` (assurance/bail/convention/…), tri par échéance, bandeau
  « Échéances à venir < 60 j » avec compte à rebours.
- **Échéances → Tâches** : `createRenewalTask` (date butoir = renouvellement − préavis,
  priorité haute, `related_label = Contrat`).
- **Communication** : `sendRenewalReminders` → mail groupé aux contreparties (via fiches CRM).
- **Charges fixes** : `montant × périodicité` → KPI « charges fixes / an » (couvre `01·G`).
- **Documents/Signature** : `document_id` → Documents ; flag `signed` (Lot 9).
- Fichiers : `contracts-meta.ts`, `contrats/{page,actions}.tsx`, `contracts-view.tsx`.

### Lot 15 — Inventaire & Matériel
- **Catalogue** : `assets` (catégorie, état, statut, emplacement, valeur, garantie, photo).
- **Prêt/retour** : `lendAsset`/`returnAsset` (détenteur = fiche `persons`), statut auto.
- **CRM** : qui a quoi (détenteur affiché sur la carte).
- **Communication** : `sendReturnReminders` → mail groupé aux détenteurs (liste de leur matériel).
- **Maintenance → Dépense** : `asset_maintenance` + `maintenanceToExpense` (coût → dépense
  `materiel`, pôle hérité du bien, lien `expense_id`).
- **Garantie** : alerte « garantie expire dans X j ».
- Fichiers : `inventory-meta.ts`, `inventaire/{page,actions}.tsx`, `inventory-view.tsx`.

### Infra transverse modifiée
- `stripe.ts` : `createCheckoutSession` accepte `metadata` générique (rétro-compat réservations).
- `webhook/route.ts` : gère `donation_id` (don payé → recette) en plus de `reservation_id`.
- `modules.ts` : 3 entrées (auto-détection via `tableKey`) + pré-activation par archétype
  (tiers-lieu : inventaire + contrats ; coworking : contrats ; association : dons).
