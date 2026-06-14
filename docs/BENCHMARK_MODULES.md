# BENCHMARK MODULES — Casa Minga Lieux vs le marché (2026-06-14)

> Pour chaque module : **une référence marché** examinée, ses **fonctionnalités
> clés**, et **notre écart**. Objectif : sortir les fonctionnalités « bout de
> chaîne » qu'on oublie (widget d'intégration, import en masse, opt-in, reçu auto…).
> Complète l'audit « bout de chaîne utilisateur » de [BACKLOG.md](../BACKLOG.md).
>
> Deux constats transversaux ressortent partout :
> **(A) Widgets/intégrations** (embarquer billetterie, adhésion, don, agenda sur
> un site tiers — WordPress en tête) et **(B) Import/Migration de données**
> (reprendre l'historique sans ressaisie).

---

## 🔌 TRANSVERSAL A — Widgets & intégrations (ex. « intégrer ses événements sur WordPress »)

**Réf : HelloAsso (4 widgets) + Eventbrite (plugin WordPress + iframe).**
Le marché ne se contente pas d'un site hébergé : il **s'exporte chez les autres**.
- HelloAsso fournit 4 **widgets embarquables** : Adhésion, Don, Crowdfunding, Billetterie — collés sur n'importe quel site via un bout de code.
- Eventbrite : **plugin WordPress officiel** + checkout en **pop-up** (l'acheteur ne quitte pas le site hôte) + **sync auto** (modif côté plateforme → mise à jour live sur le site), choix de layout (liste/grille/cartes), responsive sans code.

**Fonctionnalités cibles Casa Minga :**
- [ ] **Widget iframe embarquable** par objet : agenda/événement, tunnel adhésion, don, billetterie. (`/embed/[slug]/...`)
- [ ] **Snippet `<script>` / shortcode** + un **flux iCal/JSON/RSS** des événements (pour WordPress, Google Agenda…).
- [ ] **Plugin WordPress** (phase 2) qui consomme ce flux.
- [ ] Checkout/inscription **en pop-up** sans quitter le site hôte.

---

## 🔁 TRANSVERSAL B — Import / Migration (ex. « reprendre toutes mes anciennes factures sans ressaisir »)

**Réf : Pennylane / Evoliz / INFast — reprise d'historique.**
Le marché traite la migration comme une **fonctionnalité produit**, pas un service à part :
- Import **FEC** (fichier des écritures comptables, standard légal FR) + **CSV/Excel**.
- Reprise : **balance d'ouverture**, **factures déjà émises** (en « payées », pour l'historique/relances), **base tiers** (clients/adhérents), archivage des justificatifs.
- Méthode type : mapping colonnes → validation → test sur un exercice → go-live.

**Fonctionnalités cibles Casa Minga :**
- [ ] **Assistant d'import CSV/Excel universel** avec mapping de colonnes, prévisualisation, détection de doublons (déjà fait pour les membres — Lot 10.4 → **généraliser** à : factures, dépenses, personnes, événements, transactions).
- [ ] Import **FEC** pour la compta + balance d'ouverture.
- [ ] Import **factures historiques** marquées « payées » (sans les renvoyer).
- [ ] **Onboarding « je migre depuis X »** : un écran à la création de l'espace.

---

# Module par module

## Demandes — réf. **Zendesk / Front**
Fonctionnalités marché : boîte partagée multi-canal, **accusé de réception automatique** au demandeur, **statuts visibles côté demandeur** (portail « suivre ma demande »), assignation + tags, détection de collision (2 agents sur le même ticket), SLA/délais, déclencheurs auto.
**Notre écart :** pas d'accusé de réception ni de suivi côté demandeur ; pas de SLA ; pas d'anti-collision.

## Personnes (CRM) — réf. **AssoConnect**
Fonctionnalités marché : fiche unifiée (membres, partenaires, anciens), **historique complet** (adhésions, dons, billets, présences), segments, lié nativement à la compta et au site.
**Notre écart :** vérifier la richesse de l'historique par fiche (timeline achats/présences), segments dynamiques, **carte d'adhérent**.

## Tâches — réf. **Asana / Trello**
Fonctionnalités marché : assignation, échéances, rappels, sous-tâches, vues (liste/kanban/calendrier), récurrence, notifications.
**Notre écart :** récurrence des tâches, vue calendrier, rappels e-mail (le `tache/[token]` existe déjà ✅).

## Espaces / Réservations — réf. **Cobot / OfficeRnD**
Fonctionnalités marché : **réservation self-service** (web + mobile), **anti-double-booking**, règles par ressource (horaires, capacité, tarifs, remises), **politique d'annulation**, **facturation auto selon l'usage**, contrôle d'accès, sync Google/Outlook Agenda.
**Notre écart :** ❌ **pas de réservation en ligne côté usager** ; pas de règles tarifaires par créneau ; pas de sync calendrier externe ; facturation auto à la résa.

## Résidences / Artistes — réf. **Submittable**
Fonctionnalités marché : **formulaire de candidature public** (drag-and-drop, 50+ types de fichiers), **workflow de revue multi-étapes**, notation, revue à l'aveugle, auto-assignation/labels, communication intégrée avec le candidat, portail.
**Notre écart :** ❌ **aucune candidature en ligne** ; pas de workflow de sélection ; pas de communication candidat.

## Événements / Billetterie — réf. **Eventbrite / HelloAsso**
Fonctionnalités marché : page événement, **inscription + billet + QR + check-in**, **widget embarquable** (cf. Transversal A), billets gratuits/payants, jauges, listes d'attente, codes promo, paiement en plusieurs fois, e-mails automatiques.
**Notre état :** ✅ inscription + QR + `/scan`. **Écart :** paiement en ligne des événements payants, codes promo, listes d'attente, **widget d'intégration**.

## Adhésions — réf. **AssoConnect / HelloAsso**
Fonctionnalités marché : **campagne d'adhésion en ligne**, **paiement multi-moyens** (CB, chèque, virement, espèces), **paiement en plusieurs fois**, **reçu/justificatif auto**, **carte d'adhérent**, renouvellement, codes de réduction, widget.
**Notre écart :** ⚠️ tunnel sans **paiement en ligne**, sans **carte d'adhérent**, sans **reçu auto**.

## Finances / Factures / Dépenses — réf. **Pennylane / Evoliz**
Fonctionnalités marché : facture → **paiement en ligne** (lien), relances auto, **import FEC/CSV** (cf. Transversal B), export comptable, rapprochement bancaire, notes de frais, **compte pro/IBAN intégré** (AssoConnect 2025).
**Notre écart :** pas de **paiement en ligne** de facture, pas de relances auto, **import historique** à généraliser, rapprochement bancaire.

## Subventions — réf. **Submittable Grants / Aides-Territoires**
Fonctionnalités marché : annuaire d'aides, **import des aides** (déjà branché Aides-Territoires), suivi des dossiers par étape, échéances, pièces jointes, **assistant rédaction IA** (déjà prévu Lot 12 P4), reporting financeur.
**Notre écart :** workflow d'étapes + échéances/relances, rappels de dépôt.

## Caisse — réf. **standards NF525 (Square/SumUp)**
Fonctionnalités marché : encaissement conforme, **ticket** (PDF/imprimé), **clôture Z**, inviolabilité, moyens de paiement multiples.
**Notre état :** ✅ ticket PDF, Z, raccourcis, lien facture. **Écart :** terminal de paiement (tap-to-pay), multi-moyens.

## Documents / Signature — réf. **Yousign**
Fonctionnalités marché : **signature eIDAS**, multi-signataires, **modèles réutilisables**, relances auto, **piste d'audit** (certificat horodaté, archivage 10 ans), suivi d'avancement, intégrations.
**Notre état :** ✅ `signer/[token]`. **Écart :** modèles réutilisables, multi-signataires ordonnés, certificat/piste d'audit conforme, relances.

## Gouvernance (AG) — réf. **V8te / HelloAsso + Civicpower**
Fonctionnalités marché : **convocation** (délais légaux), **vote en ligne** (présentiel/distance/hybride), **procurations** (attribution de pouvoirs), **émargement numérique**, modes de majorité, certification RGPD des résultats, PV.
**Notre écart :** ⚠️ workflow interne OK mais **aucun vote/convocation/procuration/émargement côté membre en ligne**.

## Impact — réf. **reporting financeur**
Fonctionnalités marché : indicateurs alimentés **au fil de l'eau** depuis les autres modules (pas de saisie manuelle), tableaux, **export PDF**, **page/rapport public** pour financeurs.
**Notre écart :** indicateurs souvent manuels (cf. CUT C2) → les **alimenter automatiquement** ; **page Impact publique**.

## Site public — réf. **AssoConnect / builders**
Fonctionnalités marché : site relié au CRM, pages standard, **SEO**, nom de domaine, blog/actus, et surtout **tout est connecté** (un événement créé apparaît seul).
**Notre état :** ✅ 6 pages, thèmes, domaine perso (Lot 14), responsive corrigé. **Écart :** SEO/metadata par page, blog/actualités, opt-in newsletter.

## Communication / Newsletter — réf. **Brevo**
Fonctionnalités marché : **formulaire d'inscription public + double opt-in (RGPD)**, segmentation (attributs + engagement), **automations** (e-mail de bienvenue, séquences), transactionnel, statistiques d'ouverture/clic.
**Notre écart :** ⚠️ pas d'**opt-in public**, pas de double opt-in, pas de segmentation fine ni d'automations.

## Automatisations — réf. **Zapier / Make**
Fonctionnalités marché : déclencheurs → actions inter-modules, scénarios conditionnels, connecteurs externes.
**Notre écart :** façade fine (cf. CUT C3) — soit l'étoffer (règles e-mail/relances réelles), soit la geler.

---

# Synthèse — Top fonctionnalités à fort effet (toutes sources)

1. **💳 Paiement en ligne** (transversal) — adhésion, don, billet payant, facture, réservation. *Le marché entier en fait le cœur.*
2. **🔌 Widgets embarquables + flux iCal/JSON** — « intégrer mes événements/adhésion/don sur mon WordPress ». *Standard HelloAsso/Eventbrite.*
3. **🔁 Import/migration universel** (CSV + FEC + factures historiques) — « reprendre tout mon administratif sans ressaisir ». *Standard Pennylane/Evoliz.*
4. **🧾 Reçu fiscal & carte d'adhérent automatiques** — reliés au paiement (module reçus Cerfa existe déjà).
5. **📅 Réservation self-service + anti-double-booking** (Cobot).
6. **🗳 AG en ligne** : convocation + vote + procuration + émargement (V8te/Civicpower).
7. **✉️ Newsletter : opt-in public + double opt-in + automations** (Brevo).
8. **🎨 Candidature résidence en ligne + workflow de sélection** (Submittable).
9. **📨 Demandes : accusé auto + suivi côté demandeur** (Zendesk).
10. **📊 Impact auto-alimenté + page publique financeurs.**

## Sources
- [AssoConnect](https://www.assoconnect.com/) · [HelloAsso](https://info.helloasso.com/profils/associations) · [HelloAsso WordPress](https://wordpress.org/plugins/helloasso/)
- [Eventbrite × WordPress](https://www.eventbrite.com/blog/wordpress-and-eventbrite-better-together-ds0c/)
- [Cobot](https://www.cobot.me/en/) · [OfficeRnD](https://www.officernd.com/coworking-software/coworking-booking-platform/)
- [Submittable](https://www.submittable.com/features)
- [Pennylane migration](https://www.excilio.fr/post/reussir-migration-pennylane) · [Evoliz import](https://www.evoliz.com/blog/370-20171116-reprise-historique-import-donnees-client-facture-logiciel-facturation-saas.html)
- [Brevo signup forms](https://www.brevo.com/features/signup-forms/)
- [Yousign](https://www.capterra.com/p/182052/Yousign-On-Demand/)
- [HelloAsso × Civicpower (vote AG)](https://www.helloasso.com/blog/helloasso-et-civicpower-proposez-le-vote-en-ligne-de-votre-assemblee-generale-simplement/) · [V8te](https://www.v8te.com/fr/services/vote-associations)
- [Zendesk customer portal](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal)
