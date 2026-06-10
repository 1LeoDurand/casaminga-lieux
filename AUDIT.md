# AUDIT — Casa Minga Lieux (Sprint finition, 10 juin 2026)

> Audit Phase 1 du sprint de finition. Objectif : mise en production réelle
> pour Casa Minga (pas le SaaS commercial). Stripe Billing reporté.
> Méthode : build prod, sonde HTTP des 37 pages dashboard (mode démo),
> parcours publics, advisors Supabase, revue de code ciblée.

## 1. Santé générale — BONNE

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `next build` production | ✅ passe (proxy/middleware bien chargé) |
| 37 pages dashboard (démo vide) | ✅ 100 % répondent, **zéro 500** |
| Erreurs serveur pendant la sonde | ✅ aucune |
| Pages token invalide (`/billet`, `/espace`, `/unsubscribe`) | ✅ 404 propre |
| Pages token invalide (`/scan`, `/rejoindre`) | ✅ message d'erreur propre (200) |
| Page 404 globale | ✅ soignée, wording sympa |
| Auth dashboard | ✅ layout protège (redirect `/login`), membership vérifié |
| Login multi-org | ✅ résolution dynamique de l'org |

**L'app est nettement plus saine que le ressenti "pas fini".** Le vrai delta est
sur : sécurité DB, conformité fiscale, périmètre trop large, et l'audit
authentifié avec vraies données (non réalisable par l'agent — voir §6).

## 2. bugs.md — 3 obsolètes sur 4

| Bug | Verdict |
|---|---|
| AUTH-001 middleware au mauvais chemin | ❌ **Faux positif** — Next 16 utilise officiellement `proxy.ts` ; le build affiche `ƒ Proxy (Middleware)` |
| AUTH-002 redirect hardcodé | ✅ Déjà corrigé (résolution org dynamique) |
| AUTH-003 dashboard non protégé | ✅ Déjà corrigé (guard dans le layout) |
| DOC-001 XSS `file_url` | ⚠️ **Toujours réel** — `documents-view.tsx:179`, `<a href>` sans validation de schéma |

→ Purger `bugs.md` après correction de DOC-001.

## 3. Sécurité base de données (advisors Supabase)

### Critique
- **`assign_invoice_number` + `assign_receipt_number`** : SECURITY DEFINER,
  exécutables par `anon`, **aucune garde interne** (vérifié dans `pg_proc`).
  Un anonyme peut appeler `/rest/v1/rpc/assign_receipt_number` avec n'importe
  quel UUID d'org et **brûler des numéros séquentiels** → rupture de la
  continuité de numérotation (exigence légale factures + reçus fiscaux).
- **`cron_log` sans RLS** (niveau ERROR) — table exposée via PostgREST.

### Modéré (defense in depth)
- `cash_add_entry` / `cash_close` / `cash_verify` : exécutables par `anon`
  mais **gardées en interne** (`cash_assert_member` vérifié ✅). Révoquer
  quand même l'EXECUTE anon.
- `notifications` UPDATE avec `WITH CHECK (true)`.
- Buckets publics `feedback-screenshots` et `public-assets` : listing ouvert.
- 4 fonctions avec `search_path` mutable.
- Protection mots de passe compromis (HaveIBeenPwned) désactivée
  → **1 clic dans le dashboard Supabase Auth (action Léo)**.

## 4. Architecture & process

- **Migrations locales désynchronisées** : 4 fichiers dans
  `supabase/migrations/` vs ~40+ tables en base réelle (migrations appliquées
  via MCP sans versionnement). Le schéma de prod n'est **pas reproductible**
  depuis le repo. → dump du schéma à versionner.
- Mode démo local : tous les `DEMO_*` sont vides (par design — les vraies
  démos sont `is_demo=true` en base, gérées via `/admin/demos`). Les états
  vides tiennent bien.
- `/artistes` → 307 vers `/residences?vue=artistes` : fusion intentionnelle, OK.

## 5. Conformité légale (rappel des décisions du 10 juin)

- Reçus fiscaux : module conforme CERFA 11580*04 (montant en lettres ✅ Lot 6),
  **mais** il manque les 2 garde-fous décidés avec Léo :
  1. Déclaration d'éligibilité intérêt général + référence rescrit (paramètres)
  2. Encart « Déclaration annuelle » (total dons + nb reçus — obligation loi
     du 24/08/2021)
- Factures : numérotation séquentielle en place — fragilisée par le trou de
  sécurité §3 (les deux se corrigent ensemble).

## 6. Non audité (limites)

- **Dashboard authentifié avec vraies données** : l'agent ne saisit jamais de
  mot de passe. → recette guidée de 15 min par Léo avec checklist (proposée
  en backlog S2).
- Envoi réel d'emails SMTP, webhooks HelloAsso/Stripe en conditions réelles.
- Responsive mobile détaillé (spot-check OK, pas de passe systématique).

## 7. Périmètre — modules candidats à la coupe

Vues fines, peu ou pas branchées sur de vrais usages (décisions #23/#24
pendantes depuis des semaines) :

| Module | Lignes | Signal |
|---|---|---|
| Automatisations | 166 | v2.5, valeur faible vs complexité |
| Impact | 175 | indicateurs manuels, jamais remplis |
| Partenaires | 217 | recoupe Personnes |
| Médiathèque | 218 | recoupe Documents |
| Communauté | 232 | décision « usage réel ? » jamais tranchée |
| Upgrade/plans | — | Stripe reporté → page à neutraliser ou garder informative |

12 modules finis valent mieux que 20 modules à 80 %.
