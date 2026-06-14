# BACKLOG — Sprint finition (à arbitrer par Léo)

> Issu de AUDIT.md. Trois niveaux : MUST bloque la prod, SHOULD = forte
> valeur, CUT = proposition de suppression/gel. Après arbitrage, exécution
> autonome par vagues avec un commit par vague.

## MUST — bloque la mise en production

- [ ] **M1 — Sécurité numérotation** : migration SQL — garde membership dans
  `assign_invoice_number`/`assign_receipt_number`, revoke EXECUTE anon sur
  toutes les fonctions SECURITY DEFINER non publiques, RLS sur `cron_log`,
  `search_path` fixé sur les 4 fonctions signalées.
- [ ] **M2 — XSS `file_url`** (documents-view) : n'autoriser que `http(s)://`.
- [ ] **M3 — Garde-fous reçus fiscaux** (décidés le 10/06) :
  éligibilité intérêt général + référence rescrit dans Paramètres facturation
  (1 migration, 2-3 champs) + encart « Déclaration annuelle {année} » (total
  dons + nb reçus) dans la vue reçus.
- [ ] **M4 — Versionner le schéma réel** : dump du schéma Supabase dans le
  repo (`supabase/schema.sql` + README), purge/archivage des 4 migrations
  obsolètes.
- [ ] **M5 — Neutralisation Stripe propre** : sans clés Stripe, aucun bouton
  ne crashe ; CTA upgrade/connect masqués ou en « bientôt » explicite.
- [ ] **M6 — Hygiène** : purger bugs.md (3 obsolètes), MAJ ROADMAP (réf.
  `bernard-kohn` → `demo-tiers-lieu`).
- [ ] **M7 (action Léo, 1 clic)** : activer la protection mots de passe
  compromis dans Supabase Auth.

## SHOULD — forte valeur, non bloquant

- [ ] **S1 — Persistance du choix cookies** : vérifier que Refuser/Accepter
  est mémorisé (le bandeau semble réapparaître).
- [ ] **S2 — Recette authentifiée guidée** : checklist de 15 min pour Léo sur
  ses vraies données (je la rédige, il exécute, je corrige ce qui sort).
- [ ] **S3 — Caisse finitions** (#51-54 déjà cadrés) : rapport Z PDF, ticket
  PDF par écriture, lien client (person picker), facture auto depuis
  encaissement.
- [ ] **S4 — États vides « première fois »** : CTA d'amorçage sur les modules
  cœur (Personnes, Adhésions, Événements, Espaces) au-delà du texte.
- [ ] **S5 — Buckets storage** : retirer le listing public des 2 buckets.

## CUT — proposition de coupe (à valider un par un)

- [ ] **C1 — Communauté** (posts internes) — décision pendante depuis des
  semaines = signal. Supprimer la nav + page (code conservé en git).
- [ ] **C2 — Impact** — indicateurs manuels jamais remplis.
- [ ] **C3 — Automatisations** — façade fine, complexité > valeur.
- [ ] **C4 — Partenaires** — fusionner dans Personnes (tag « partenaire ») ?
- [ ] **C5 — Médiathèque** — fusionner dans Documents ?
- [ ] **C6 — Upgrade/plans** — masquer tant que Stripe est reporté (lié M5).
- [ ] **C7 — Trial 3 mois** (#24) — sans Stripe, le trial n'a pas de sens : geler.

## Vagues d'exécution proposées (après arbitrage)

1. **Vague Sécurité** : M1 + M2 + S5 (migration + 1 fix front)
2. **Vague Conformité fiscale** : M3 (migration + paramètres + encart)
3. **Vague Périmètre** : CUTs validés + M5/C6 (nav, modules)
4. **Vague Hygiène/Schéma** : M4 + M6 + S1
5. **Vague Caisse** : S3 (le plus gros morceau)
6. **Recette finale** : S2 + S4, corrections issues de la recette

---

# UPGRADES — Audit « bout de chaîne utilisateur » (2026-06-14)

> Audit module par module **du point de vue de l'utilisateur final** (adhérent,
> visiteur, artiste, client), pas du coordinateur. Question posée à chaque
> module : *la chaîne va-t-elle jusqu'à l'usager, ou s'arrête-t-elle au
> back-office ?* Vérifié dans le code (présence/absence d'`actions.ts` et de
> route publique). Déclencheur : la billetterie était incomplète faute de
> QR code → maillon final manquant. **Le QR + `/scan` sont désormais en place.**
>
> Légende : ✅ chaîne complète · ⚠️ maillon partiel · ❌ aucun bout de chaîne usager.
>
> 📊 Benchmark marché détaillé (1 référence SaaS par module + features cibles) :
> [docs/BENCHMARK_MODULES.md](docs/BENCHMARK_MODULES.md).

## Constat transversal n°1 — le PAIEMENT EN LIGNE manque (bloque 3 chaînes)

Aujourd'hui toutes les chaînes « payantes » s'arrêtent **au moment de payer** :
réserver un espace payant, payer une adhésion, faire un don.
- Cause : décision modèle paiement (Stripe Billing / HelloAsso) en attente.
- Réfs liées : Lot 10.1, 10.1-bis B/C.

## Pilotage
- **Demandes** — ✅ **CORRECTION 14/06** : l'accusé de réception au demandeur
  EXISTE déjà (l'audit s'était trompé — le flux passe par la route API
  `/api/orgs/<slug>/requests`, pas par `site/<slug>`). `tplDemandeRecue` envoyé
  au demandeur + `tplDemandeStatut` à chaque changement de statut + alerte
  équipe. *Reste optionnel : un lien de suivi self-service (portail) — non
  prioritaire, l'email couvre le besoin.*
- **Personnes (CRM)** — ✅ L'adhérent a son espace `/espace` (Lot 7).
  *Upgrade SHOULD : carte d'adhérent / attestation téléchargeable depuis `/espace`.*
- **Tâches** — ✅ Assigné agit via `tache/[token]`.

## Gestion du lieu
- **Espaces / Réservations** — ❌ **Maillon n°1.** `site/[slug]/espaces` = catalogue
  sans `actions.ts` → impossible de réserver/demander en ligne. *Upgrade : tunnel
  public « réserver » (sans paiement d'abord, paiement ensuite) — Lot 10.1-bis B.*
- **Résidences / Artistes** — ❌ **Aucune route publique de candidature.** Un artiste
  ne peut pas postuler en ligne. *Upgrade : `site/[slug]/residences/candidater`
  → crée une candidature dans le module Résidences.*
- **Événements / Billetterie** — ✅ Agenda → inscription (`agenda/[id]/actions.ts`)
  → billet + **QR** + `/scan` (check-in). Chaîne bouclée. ⚠️ reste le **paiement**
  des événements payants.

## Structure
- **Adhésions** — ⚠️ `adhesion/[campaignSlug]` = page seule, **0 paiement / 0 carte
  / 0 reçu**. *Upgrade : paiement adhésion en ligne + carte d'adhérent + reçu/justif
  dans `/espace`.*
- **Finances / Factures** — ⚠️ Pas de **paiement en ligne** de la facture par le
  client (Stripe en attente). *Upgrade : lien de paiement sur la facture.*
- **Caisse** — ✅ Ticket PDF, Z. Interne, complet.
- **Dépenses / Subventions / Impact** — ➖ Coordinateur-only (normal).
  *Upgrade opportun : **page Impact publique** sur le site (valoriser auprès du
  grand public et des financeurs).*
- **Gouvernance (AG)** — ⚠️ Workflow AG interne (Lot 8) mais **aucune route
  publique de convocation / vote / procuration côté membre**. *Upgrade : lien
  `vote/[token]` pour voter et donner procuration à distance.*
- **Documents** — ✅ Signature via `signer/[token]`.

## Communication
- **Site public** — ✅ 6 pages, responsive corrigé (14/06).
- **Communication / Newsletter** — ⚠️ Désinscription OK (`unsubscribe/[token]`)
  mais **aucun opt-in public** : un visiteur ne peut pas s'abonner depuis le site.
  *Upgrade : bloc « s'abonner à la newsletter » sur le site public.*
- **Soutenir / Don** — ❌ **Maillon n°2.** Page = liens externes (HelloAsso/mailto),
  **pas de don en ligne intégré**. *Upgrade : don en ligne (HelloAsso ou Stripe)
  + reçu fiscal automatique (le module reçus Cerfa existe déjà → à relier).*

## Système
- **Équipe / Paramètres** — ✅ Invitations (`rejoindre/[token]`), gestion accès.
- **Automatisations** — ⚠️ Façade fine (cf. C3). Pas de bout usager.

## Priorisation des maillons à boucler (valeur usager décroissante)

1. **💳 Paiement en ligne** (transversal) — débloque réservation + adhésion + don.
   *Prérequis : décision modèle (Stripe vs HelloAsso) — action Léo.*
2. **📅 Réserver un espace en ligne** (Lot 10.1-bis B).
3. **🎁 Don en ligne + reçu fiscal auto** (relie Soutenir ↔ module reçus Cerfa).
4. **🎨 Candidater à une résidence** (route publique → module Résidences).
5. **🗳 Vote AG à distance** côté membre (`vote/[token]`).
6. **Quick wins** (rapides, fort effet perçu) :
   - ~~accusé de réception + suivi côté **demandeur**~~ → ✅ existait déjà (14/06) ;
   - ~~**opt-in newsletter** sur le site public~~ → ✅ livré (14/06, sans migration) ;
   - **carte d'adhérent / attestation** dans `/espace` ;
   - **page Impact publique** (nécessite 1 migration : flag « public » par indicateur).
