# 🏗️ Spec d'évolution — Casa Minga Lieux

> **Rédigé par Opus (architecte) — à exécuter par Sonnet (build), lot par lot.**
> Dernière mise à jour : 2026-06-05
> Ce document est auto-suffisant : un contexte Sonnet « froid » doit pouvoir exécuter chaque lot sans re-décider l'architecture.

---

## 📐 Conventions du projet (à respecter pour CHAQUE lot)

**Stack** : Next.js 16 App Router · Supabase (SSR + service_role) · TypeScript · Tailwind.

**Supabase** : projet `gzijdwrzcuokvfkpcczr` (« Maison commune »). Org pilote Bernard Kohn = `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`.

**Migrations** : appliquer via le **MCP Supabase `apply_migration`** (les fichiers locaux `supabase/migrations/0001-0004` sont historiques, on ne les complète plus). Nommage : `v5_x_<nom>`. Toujours `IF NOT EXISTS`.

**RLS** : chaque table multi-tenant a `organization_id uuid`. Policies :
- SELECT : `is_org_member(organization_id)`
- INSERT/UPDATE/DELETE : `is_org_admin(organization_id)`
- Ces deux fonctions sont **SECURITY DEFINER** (ne jamais les réécrire en SQL inline → récursion RLS).

**Arborescence d'un module** :
- Route : `src/app/(admin)/dashboard/[org]/<segment>/` → `page.tsx`, `actions.ts`, `error.tsx`, `loading.tsx`
- Vue cliente : `src/components/mc/<nom>-view.tsx` · Formulaire : `<nom>-form.tsx`
- Métadonnées/labels : `src/lib/<nom>-meta.ts`
- Types : ajouter à `src/lib/types.ts`
- Entrée sidebar : `src/lib/modules.ts` → `MODULE_SECTIONS` (champ `tableKey` = détection auto d'activation)

**Server actions** : `"use server"` · `createClient()` depuis `@/lib/supabase/server` · garde `if (!isSupabaseConfigured()) return …` · erreurs via `humanError()` (`@/lib/errors`) · `revalidatePath()` après mutation.

**Params async (Next 15+)** : `params: Promise<{ org: string }>` → `const { org } = await params`.

**⚠️ RÈGLE GIT ABSOLUE** : ne **jamais** `git push` sans demande explicite de Léo. Commits locaux OK, push = jamais sauf ordre direct.

**Modèle de travail** : Léo bascule Opus (design/stratégie) ↔ Sonnet (exécution). Ce doc = pont entre les deux.

---

## 🎯 Ordre de priorité (point de vue Opus)

Deux familles : **(A) confort des clients déjà acquis** vs **(B) capacité à acquérir/scaler**. La survie passe avant le confort, mais les quick-wins (Lot 0) se font d'abord car gratuits.

| Lot | Titre | Famille | Effort |
|-----|-------|---------|--------|
| 0 | Quick-wins | A | S |
| 1 | Pôles structurés | A (socle) | M |
| 2 | Facturation v5 | A | M |
| 3 | Module Dépenses | A | M |
| 4 | Gestion utilisateurs autonome | A/B | M |
| 5 | Inscriptions & billetterie événements | B | L |
| 6 | Reçus fiscaux Cerfa | B | M |
| 7 | Espace membre / portail adhérent | B | L |
| 8 | Workflow Assemblée Générale | A | M |
| 9 | Signature électronique contrats | A | L |
| 10 | Stratégique (décisions produit requises) | B | — |
| 11 | Infra (actions manuelles Léo) | — | S |
| 12 | Subventions P2→P4 | A | L |

> Faire **0 → 1 → 2 → 3** d'affilée (le pôle débloque la classification factures + dépenses). Les lots 5/7 sont les plus gros leviers business mais demandent plus de temps.

---

# LOT 0 — Quick-wins immédiats

### 0.1 — Toggle « Afficher sur le site public » pour les événements
**Objectif** : choisir événement par événement s'il apparaît sur le site public.

**Migration** `v5_0_event_public_toggle` :
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_on_public_site boolean NOT NULL DEFAULT false;
```
**Backend** :
- `src/lib/types.ts` → `interface Evenement` : ajouter `show_on_public_site: boolean;`
- `src/app/(admin)/dashboard/[org]/evenements/actions.ts` : inclure le champ dans l'input + le payload insert/update.
- Requête site public (chercher dans `src/lib/site-public/` ou `src/lib/data.ts` la fonction qui liste les events publics) : filtrer `.eq("show_on_public_site", true)`.

**Frontend** : dans le formulaire événement (`src/components/mc/event-form.tsx` ou équivalent), ajouter une case à cocher « Afficher sur le site public » (défaut décoché). Afficher un petit badge 🌐 dans la liste des events quand actif.

**Critères** : event coché ⇒ visible sur `/site/[slug]` ; décoché ⇒ absent. Migration auto des events existants = `false` (on ne publie rien sans choix explicite).

### 0.2 — Upload de fichier direct dans Documents
**Objectif** : remplacer la saisie d'URL manuelle par un upload navigateur.

**Pré-requis** : bucket Supabase Storage `public-assets` (vérifier qu'il existe, sinon le créer via MCP). Policy : upload réservé aux membres de l'org, chemin `org/<organization_id>/documents/<uuid>-<filename>`.

**Frontend** : dans `src/components/mc/document-form.tsx`, ajouter `<input type="file">` → upload client-side via `createClient()` (`@/lib/supabase/client`) `.storage.from("public-assets").upload(...)` → récupérer l'URL publique → remplir `file_url` + `file_name`. Garder l'option URL manuelle en fallback.

**Critères** : drag/sélection d'un PDF ⇒ stocké, `file_url`/`file_name` remplis automatiquement, document consultable.

### 0.3 — En-têtes de colonnes + champ Objet dans l'éditeur de facture
**Objectif** : lisibilité de l'éditeur (`src/components/mc/invoice-editor.tsx`).

**Frontend uniquement (pas de migration pour les en-têtes)** :
- Au-dessus de la liste de lignes, ajouter une ligne d'en-tête grid alignée : `Désignation | Qté | Prix unit. HT | TVA | Total`.
- Le **champ Objet** est traité au Lot 2.2 (nécessite une colonne). Si on veut le livrer ici, voir migration Lot 2.2.

**Critères** : chaque colonne de l'éditeur est étiquetée ; plus d'ambiguïté sur Qté vs Prix.

---

# LOT 1 — Pôles / activités structurés (SOCLE)

**Objectif** : transformer le champ texte libre `pole` en vraie entité par org. Une MJC aura « Culture », « Événements », « Parentalité » ; un tiers-lieu « Coworking », « Résidences », « Café ». Débloque la classification cohérente sur factures, dépenses, events, subventions.

**Migration** `v5_1_poles` :
```sql
CREATE TABLE IF NOT EXISTS poles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#FF8A65',
  description     text,
  active          boolean NOT NULL DEFAULT true,
  position        int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE poles ENABLE ROW LEVEL SECURITY;
CREATE POLICY poles_select ON poles FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY poles_write  ON poles FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));

-- Rattachement (on garde aussi le texte libre existant pour rétro-compat / migration douce)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pole_id uuid REFERENCES poles(id) ON DELETE SET NULL;
```

**Backend** :
- Type `Pole` dans `src/lib/types.ts`.
- `src/lib/poles.ts` : `getPoles(orgId)`, helpers CRUD (server actions).
- Page de gestion : soit une section dans **Paramètres** (`/dashboard/[org]/parametres`), soit un petit gestionnaire modal accessible là où on choisit un pôle. Recommandé : **bouton « Gérer les pôles » dans Paramètres** + modal CRUD (nom, couleur, description, actif, réordonner).

**Frontend** : partout où un pôle est saisi (factures, plus tard dépenses/events), remplacer l'input texte libre par un **`<select>` alimenté par `poles`** + option « + Nouveau pôle » qui ouvre le mini-CRUD. Garder une migration douce : si `pole` (texte) existe mais pas `pole_id`, proposer de matcher.

**Critères** : un admin crée/édite ses pôles ; le sélecteur de pôle sur les factures liste les pôles de SON org ; couleur réutilisée dans les récaps.

---

# LOT 2 — Facturation v5

> État actuel déjà livré : éditeur, lignes, TVA cas par cas, émission/numéro figé, statuts, PDF serveur, coworking, avoirs, relances, export CSV. Colonnes déjà présentes : `pole` (texte), `payment_method`, `paid_at`.

### 2.1 — Numérotation flexible + référence libre
**Objectif** : reprendre un historique (org qui avait déjà des factures) + référence interne libre.

**Migration** `v5_2_invoice_numbering` :
```sql
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS number_start int NOT NULL DEFAULT 1;
ALTER TABLE invoices        ADD COLUMN IF NOT EXISTS reference text;
```
**Backend** :
- Adapter la fonction Postgres `assign_invoice_number` : le 1er numéro émis pour l'org = `max(number_start, dernier+1)`. Ne JAMAIS reculer (intégrité légale). Tester l'atomicité (lock).
- `invoice_settings` : exposer `number_start` dans Paramètres → Facturation (éditable **seulement tant qu'aucune facture n'est émise** ; verrouiller après la 1ʳᵉ émission, message explicatif).
- `reference` : champ libre dans l'éditeur, affiché sur le PDF (≠ du numéro légal auto).

**Critères** : org configure « première facture = 47 » avant toute émission ⇒ FAC-000047. Référence libre apparaît sur PDF + liste. Numéro auto reste continu et inaltérable.

### 2.2 — Champ « Objet » au-dessus des lignes
**Migration** `v5_2b_invoice_object` :
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS object text;
```
**Backend** : `Invoice` type + `InvoiceInput` + `saveInvoice` payload (`src/app/(admin)/dashboard/[org]/factures/actions.ts`).
**Frontend** : zone `<textarea>` « Objet de la facture » dans `invoice-editor.tsx`, placée **entre le bloc client et le tableau de lignes**. Rendu sur le PDF (`src/lib/invoicing/pdf.tsx`) au même endroit.
**Critères** : objet saisi ⇒ visible éditeur + PDF + vue détail.

### 2.3 — Classification par pôle (branchée sur Lot 1)
Remplacer dans `invoice-editor.tsx` le champ texte `pole` par le `<select>` de pôles (`pole_id`). Récap recettes par pôle (déjà dans `invoices-view.tsx`) : grouper sur `pole_id` + afficher la couleur du pôle. Garder rétro-compat avec l'ancien `pole` texte le temps de la migration.

### 2.4 — Suivi paiement raffiné (déjà à 80 %)
Déjà en place : modale de paiement, `payment_method`, `paid_at`, indicateurs ✅ Payé / ⏳ À payer, colonne Règlement. **Compléter** :
- Afficher la **date de paiement** (`paid_at`) dans la liste à côté du mode.
- Reporter mode + date sur le **PDF** quand payée (mention « Réglée le JJ/MM/AAAA par [mode] »).
**Critères** : une facture payée montre comment ET quand, dans la liste, la vue détail et le PDF.

---

# LOT 3 — Module Dépenses (nouveau module)

**Objectif** : pendant des recettes (factures). Suivre les charges, croiser par pôle.

**Migration** `v5_3_expenses` :
```sql
CREATE TABLE IF NOT EXISTS expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label           text NOT NULL,
  amount_ttc      numeric(12,2) NOT NULL DEFAULT 0,
  vat_applicable  boolean NOT NULL DEFAULT false,
  vat_amount      numeric(12,2),
  category        text,                         -- loyer|fournitures|salaires|services|deplacement|autre
  supplier_name   text,
  supplier_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  pole_id         uuid REFERENCES poles(id) ON DELETE SET NULL,
  payment_method  text,                         -- virement|cheque|cash|carte
  paid_at         date,
  receipt_url     text,                         -- justificatif (Storage)
  notes           text,
  spent_at        date NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_select ON expenses FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY expenses_write  ON expenses FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
```

**Backend** :
- Type `Expense` + meta `src/lib/expenses-meta.ts` (catégories avec emoji/label, réutiliser `PAYMENT_METHODS` de `invoicing/types.ts`).
- Route `src/app/(admin)/dashboard/[org]/depenses/` (page + actions + error + loading) sur le modèle de `factures`.
- Module dans `src/lib/modules.ts` section **Structure** : `{ key: "depenses", label: "Dépenses", segment: "depenses", layer: 1, tableKey: "expenses", description: "Charges et justificatifs." }`.
- Upload justificatif = même mécanique que Lot 0.2 (bucket `public-assets`).

**Frontend** (`src/components/mc/expenses-view.tsx` + `expense-form.tsx`) :
- Liste avec filtres statut payé/à payer, catégorie, pôle.
- KPIs : total du mois, total à payer, total par pôle.
- **Récap croisé recettes/dépenses par pôle** : tableau Pôle | Recettes (somme `invoices` payées) | Dépenses (somme `expenses` payées) | **Solde**. Source recettes = réutiliser le `recapByPole` existant côté factures (factoriser un helper `src/lib/finance-by-pole.ts` lisant les deux tables).
- Export CSV (modèle `/factures/export`).

**Critères** : créer une dépense avec justificatif + pôle ⇒ apparaît dans le récap croisé, solde par pôle juste.

---

# LOT 4 — Gestion des utilisateurs par l'admin (style WordPress)

**Objectif** : l'admin du lieu gère ses membres en autonomie, sans passer par Léo. Tables `organization_members` + `invitations` existent déjà.

**Migration** `v5_4_member_admin` (si colonnes absentes) :
```sql
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'actif'; -- actif|suspendu
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
```

**Backend** — server actions (garde `is_org_admin` obligatoire) dans `src/app/(admin)/dashboard/[org]/equipe/actions.ts` :
- `inviteMember(orgId, email, role)` → crée une ligne `invitations` (token hex 32o, expire 7j) + envoie l'email via `sendMail` (template à ajouter `tplInvitationMembre`, lien `/rejoindre/[token]`).
- `changeMemberRole(memberId, role)` · `setMemberStatus(memberId, 'actif'|'suspendu')` · `removeMember(memberId)`.
- `listPendingInvitations(orgId)` + `resendInvitation(id)` + `revokeInvitation(id)`.
- ⚠️ Empêcher un admin de se retirer/rétrograder lui-même s'il est le dernier admin.

**Frontend** — enrichir la page **Équipe** (`/dashboard/[org]/equipe`, vue existante) :
- Liste membres : nom, email, rôle (select inline admin/membre/lecture), statut (toggle actif/suspendu), dernière activité, action retirer.
- Section « Invitations en attente » : email, rôle, date, boutons Relancer / Révoquer.
- Bouton « + Inviter un membre » → modal (email + rôle).

**Critères** : un admin invite quelqu'un par email, voit l'invitation en attente, change un rôle, suspend un compte — **sans intervention de Léo**. Garde-fous : pas de suppression du dernier admin.

---

# LOT 5 — Inscriptions & billetterie événements ⭐ (gros levier)

**Objectif** : débloquer 3 choses d'un coup → inscriptions, billetterie payante, rappels J-1 (déjà codés, désactivés faute de table), feuilles de présence.

**Migration** `v5_5_event_registrations` :
```sql
CREATE TABLE IF NOT EXISTS event_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES persons(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  seats           int NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'inscrit',   -- inscrit|liste_attente|annule
  payment_status  text NOT NULL DEFAULT 'gratuit',   -- gratuit|a_payer|paye|rembourse
  amount_ttc      numeric(10,2) NOT NULL DEFAULT 0,
  checked_in_at   timestamptz,                        -- feuille de présence
  source          text NOT NULL DEFAULT 'public',     -- public|manuel
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY evreg_select ON event_registrations FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY evreg_write  ON event_registrations FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
-- Inscription publique : insertion autorisée sans auth (formulaire site public) via route service_role, PAS via RLS public.
```

**Backend** :
- Route publique d'inscription : `src/app/api/events/[id]/register/route.ts` (service_role, validation capacité, gère liste d'attente si complet, envoie email de confirmation `tplEventInscription`).
- Gestion capacité : si `seats` cumulés ≥ `events.capacity` ⇒ `liste_attente`.
- Email rappel J-1 : réactiver la logique existante (chercher `/api/cron/reminders`) en la branchant sur `event_registrations`.

**Frontend** :
- **Site public** (`/site/[slug]`) : bouton « S'inscrire » sur chaque event où `capacity` non nul ou `price` défini → formulaire (nom, email, tél, nb places). Si payant : afficher le montant (paiement réel = Lot 10 Stripe, en attendant statut `a_payer` + paiement sur place).
- **Dashboard event** : onglet « Inscrits » → liste, compteur places restantes, ajout manuel, export CSV, **mode check-in** (bouton présence → `checked_in_at`).

**Critères** : un visiteur s'inscrit depuis le site, reçoit un email, apparaît dans la liste admin ; complet ⇒ liste d'attente ; l'admin fait l'émargement le jour J.

> Décision produit à confirmer avec Léo avant billetterie payante : encaissement (Stripe direct event ? HelloAsso ? sur place ?). Tant que non tranché : inscriptions gratuites + statut `a_payer` manuel.

---

# LOT 6 — Reçus fiscaux Cerfa (différenciateur asso FR)

**Objectif** : générer le reçu fiscal Cerfa n°11580*04 pour les dons (réduction d'impôt 66 %). Argument de conversion fort.

**Migration** `v5_6_tax_receipts` :
```sql
CREATE TABLE IF NOT EXISTS tax_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number          text,                          -- numérotation continue par org, ex. REC-2026-0001
  donor_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  donor_name      text NOT NULL,
  donor_address   text,
  amount          numeric(12,2) NOT NULL,
  donation_date   date NOT NULL,
  donation_type   text NOT NULL DEFAULT 'numeraire', -- numeraire|cheque|virement|titres
  fiscal_year     int NOT NULL,
  transaction_id  uuid,                          -- lien finances/transactions si applicable
  pdf_url         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tax_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY taxr_select ON tax_receipts FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY taxr_write  ON tax_receipts FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
```
+ fonction `assign_receipt_number(p_org, p_year)` atomique (continue par org).

**Pré-requis org** : `invoice_settings` (ou table org) doit fournir : nom asso, adresse, objet, qualité (association d'intérêt général / œuvre…), n° préfecture, signataire. Ajouter ces champs si absents (réutiliser `invoice_settings` : `tax_receipt_quality`, `tax_receipt_signatory`).

**Backend** :
- `src/lib/tax-receipts/pdf.tsx` : reproduire le **gabarit Cerfa 11580*04** (mentions légales exactes : article 200/238 bis CGI, montant en chiffres + lettres, forme du don, signature). `@react-pdf/renderer` déjà dispo.
- Génération depuis une transaction « don » des Finances OU saisie manuelle.

**Frontend** : route `/dashboard/[org]/factures/recus` (ou nouveau module « Reçus fiscaux ») : liste, bouton « Émettre un reçu », envoi par email, export annuel groupé (pour la campagne IFI/IR de janvier).

**Critères** : émettre un reçu conforme Cerfa, numéroté, PDF téléchargeable + envoyable, total annuel par donateur.

> ⚠️ Conformité fiscale : faire valider le gabarit par Léo (mentions exactes) avant mise en prod.

---

# LOT 7 — Espace membre / portail adhérent ⭐ (gros levier)

**Objectif** : l'adhérent se connecte pour s'auto-servir (voir/renouveler son adhésion, télécharger reçus/factures, s'inscrire aux events, voir ses contrats). Enlève l'admin du chemin critique.

**Architecture** : nouveau groupe de routes `src/app/(membre)/espace/` (layout distinct du `(admin)`), auth Supabase classique. Un user peut être membre sans être `organization_member` admin → distinguer **rôle plateforme** (gestionnaire) vs **adhérent**.

**Migration** `v5_7_member_portal` : s'appuyer sur `persons` (lien `persons.auth_user_id uuid`) pour relier un compte auth à une fiche personne.
```sql
ALTER TABLE persons ADD COLUMN IF NOT EXISTS auth_user_id uuid;
```

**Pages portail** :
- `/espace` : tableau de bord adhérent (mon adhésion, échéance, bouton renouveler).
- `/espace/adhesion` : statut + renouvellement (réutilise le tunnel d'adhésion existant).
- `/espace/evenements` : events à venir de son/ses org(s) + s'inscrire.
- `/espace/documents` : ses reçus fiscaux, factures coworking, contrats.

**Critères** : un adhérent se connecte, voit son adhésion, la renouvelle seul, télécharge son reçu — sans intervention admin.

> Gros lot : commencer par `/espace` + `/espace/adhesion` (MVP), puis events/documents.

---

# LOT 8 — Workflow Assemblée Générale

**Objectif** : compléter Gouvernance (mandats/réunions/votes existants) avec le workflow AG légal annuel.

**Migration** `v5_8_general_assembly` :
```sql
ALTER TABLE governance_meetings ADD COLUMN IF NOT EXISTS is_general_assembly boolean NOT NULL DEFAULT false;
ALTER TABLE governance_meetings ADD COLUMN IF NOT EXISTS quorum int;

CREATE TABLE IF NOT EXISTS assembly_proxies (        -- pouvoirs / procurations
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_id      uuid NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  giver_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  holder_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assembly_proxies ENABLE ROW LEVEL SECURITY;
CREATE POLICY proxy_select ON assembly_proxies FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY proxy_write  ON assembly_proxies FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));

CREATE TABLE IF NOT EXISTS assembly_attendance (     -- émargement
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_id      uuid NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  person_id       uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  present         boolean NOT NULL DEFAULT true,
  checked_in_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assembly_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_select ON assembly_attendance FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY att_write  ON assembly_attendance FOR ALL    USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
```

**Fonctionnalités** (dans le module Gouvernance) :
- **Convocation en masse** : email à tous les adhérents à jour (réutiliser ciblage newsletter + `member_groups`), template `tplConvocationAG` (ordre du jour, date, lieu, lien pouvoir).
- **Pouvoirs** : un adhérent donne pouvoir à un autre ; calcul quorum = présents + pouvoirs vs `quorum`.
- **Émargement** : feuille de présence le jour J (réutilise le pattern check-in du Lot 5).
- **PV** : génération PDF du procès-verbal (présents, pouvoirs, résolutions votées + résultats des votes existants).

**Critères** : créer une AG, convoquer les adhérents, enregistrer pouvoirs + émargement, vérifier le quorum, générer le PV PDF.

---

# LOT 9 — Signature électronique des contrats

**Objectif** : contrats coworking (et autres) signés en ligne. Roadmap détaillée déjà écrite (3 étapes).

**Migration** `v5_9_document_signing` :
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signing_status text;      -- null|en_attente|signe|expire
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signing_provider text;    -- yousign|docuseal|manuel
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signing_token text;
```

**Étapes** :
1. **Templates de contrat** en base (HTML/Markdown avec `{{nom}}`, `{{adresse}}`, `{{siret}}`, `{{date_debut}}`, `{{tarif}}`) → bouton « Générer contrat » sur la fiche coworker, pré-rempli depuis le CRM, PDF via `@react-pdf/renderer`, stocké dans `documents`.
2. **Signature** : intégrer **DocuSeal** (open-source, auto-hébergé, gratuit, suffisant pour 190€/mois) ou **Yousign** (eIDAS si valeur probante voulue). Flux : Générer → Envoyer pour signature (lien email unique via `signing_token`) → webhook signé → PDF signé `status: 'signe'` + `signed_at`.
3. **Statut sur fiche coworker** : En attente / Signé le [date] / Expiré.

**Décision produit** : DocuSeal vs Yousign → demander à Léo. Recommandation Opus : **DocuSeal auto-hébergé** (coût nul, suffisant pour ce cas d'usage).

**Critères** : générer un contrat pré-rempli, l'envoyer, le coworker signe, statut « Signé le … » visible.

---

# LOT 10 — Stratégique (DÉCISIONS PRODUIT REQUISES avant build)

> ⚠️ Ne PAS coder sans valider l'architecture avec Léo (Opus). Ce lot conditionne le scaling.

### 10.1 — Abonnement SaaS (Stripe Billing) — modèle économique
Aujourd'hui : page pricing existe, mais **aucun encaissement d'abonnement**. Chaque client = acte manuel de Léo.
**À décider** : plans (gratuit/asso/pro ?), prix, essai 30j, Stripe Checkout + Customer Portal, paywall après essai, webhook `customer.subscription.*` → table `org_subscriptions`. **C'est le chantier #1 pour scaler.**

> ℹ️ **À ne pas confondre avec l'encaissement des réservations (fait, Lot A ci-dessous).** 10.1 = abonnement SaaS *des lieux à Casa Minga*. Le Lot A = paiement *des clients aux lieux* (Stripe Connect).

### 10.1-bis — Paiement des réservations par lieu (Stripe Connect) — ✅ Lot A FAIT
Décisions Léo : **Stripe Connect** (compte par lieu), **0 % de commission**, périmètre **lien de paiement sur réservation confirmée** (pas de tunnel public self-service).
Livré : connexion Stripe dans Paramètres, bouton « Envoyer le lien de paiement » dans le tiroir réservation, webhook `checkout.session.completed` → réservation payée, email `tplLienPaiement`.
- **Lot B (à faire)** : tunnel public self-service « réserver + payer » depuis le site public.
- **Lot C (à faire)** : acompte %, remboursement, reçu PDF.

### 10.2 — RGPD opérationnel
Droit à l'oubli (export + suppression d'un membre sur demande), registre des traitements, anonymisation. Risque légal réel (centaines d'adhérents).

### 10.3 — Notifications réelles
La cloche de la topbar (`src/components/mc/dashboard-topbar.tsx`) est décorative. Construire : table `notifications`, déclencheurs (nouvelle demande, facture en retard, inscription event…), badge réel, page `/notifications`.

### 10.4 — Import de données
Onboarding bloquant : une org migrant de Yapla/Excel doit importer ses membres (CSV → mapping colonnes → `persons`). Sans ça, mur à l'entrée.

### 10.5 — Recherche globale
Vérifier si la barre de recherche topbar est fonctionnelle ; sinon, recherche cross-modules (personnes, events, factures, documents).

---

# LOT 11 — Infra (actions MANUELLES de Léo, pas de code)

- **Domaine casaminga.com** : Infomaniak → Hébergement → ajouter `casaminga.com` (+ www) sur la même app Node que `admin.casaminga.com` + cert SSL. Code déjà prêt (`proxy.ts`, `publicSiteUrl()`).
- **NODE_OPTIONS** : Infomaniak → Node.js 56239 → Variables d'env → `NODE_OPTIONS = --max-old-space-size=1536`.
- **CRON_SECRET** : secret GitHub Actions + même valeur en env serveur `.env.local` (active crons factures/relances/rappels).
- **Google Analytics** : créer une propriété GA4 sur analytics.google.com → Administration → Flux de données → copier l'ID de mesure (ex: `G-XXXXXXXXXX`) → `.env.local` : `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`. Le bandeau cookies et le chargement conditionnel sont déjà en place.
- **Stripe Connect (paiement des réservations — Lot A)** : le code est prêt, il manque la config plateforme :
  1. Compte Stripe plateforme Casa Minga → Développeurs → clés API → `.env.local` : `STRIPE_SECRET_KEY=sk_live_...`
  2. Activer **Connect** dans le dashboard Stripe (Settings → Connect), type de compte **Standard**.
  3. Créer **un seul** endpoint webhook **Connect** → URL `https://admin.casaminga.com/api/orgs/platform/stripe/webhook` (le `[slug]` est ignoré, le matching se fait par `metadata.reservation_id`), événement **`checkout.session.completed`** → copier le secret de signature → `.env.local` : `STRIPE_WEBHOOK_SECRET=whsec_...`
  4. `NEXT_PUBLIC_APP_URL=https://admin.casaminga.com` (déjà utilisé ailleurs) sert aux URLs de retour d'onboarding.
  Ensuite chaque lieu connecte son compte depuis Paramètres → Intégrations → Stripe.

---

# LOT 12 — Subventions P2 → P4

- **P2** : statuts de candidature par lieu (table `grant_applications` : intéressé/en cours/déposé/obtenu). « Obtenu » → crée une ligne dans `grants`.
- **P3** : dossier guidé `/subventions/veille/[id]` — checklist pièces + pré-remplissage depuis `org_grant_profile` + KPIs Impact/Finances.
- **P4** : import API **Aides-Territoires** (anti-doublon `external_id`) + **assistance rédaction IA** (API Claude) des parties narratives.

Lib existante : `src/lib/grants/`.

---

## ✅ Checklist transverse (à faire pour CHAQUE lot avant de clôturer)
- [ ] Migration appliquée via MCP Supabase + RLS testée (membre voit, non-membre ne voit pas)
- [ ] Types ajoutés à `src/lib/types.ts`
- [ ] `npm run build` passe (mémoire limitée : `NODE_OPTIONS` déjà dans les scripts)
- [ ] Entrée sidebar ajoutée si nouveau module (`src/lib/modules.ts`)
- [ ] Données démo NON réintroduites (les arrays `DEMO_*` restent vides)
- [ ] **PAS de git push** — commit local seulement, attendre l'ordre de Léo
- [ ] Roadmap (`memory/roadmap.md`) mise à jour : lot coché + commit hash

---

*Fin de spec. Pour démarrer : « Sonnet, attaque le LOT 0 ».*
