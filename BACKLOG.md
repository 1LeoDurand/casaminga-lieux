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
