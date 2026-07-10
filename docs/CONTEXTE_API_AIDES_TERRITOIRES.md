# Contexte API Aides-Territoires — module Subventions

> Notes de référence pour le chantier « tri des ~1 400 aides » (veille subventions).
> Sources : https://aides-territoires.beta.gouv.fr/api (index), https://aides-territoires.beta.gouv.fr/api/schema/ (swagger, v1.8.4),
> https://www.data.gouv.fr/dataservices/api-aides-territoires. Rédigé le 2026-07-10.

## Authentification
- Clé API longue (compte AT requis) → `POST /api/connexion/` avec header `X-AUTH-TOKEN: <clé>` → renvoie `{ token }`.
- Le token s'utilise en `Authorization: Bearer <token>`. Validité courte (24 h annoncées par AT) → ré-échanger à chaque sync.
- Déjà implémenté chez nous : `src/lib/grants/aides-territoires.ts` (`getBearer`), clé dans `AIDES_TERRITOIRES_API_KEY`.
- Pas de rate limit documenté. Licence Ouverte v2.0 (Etalab). Contact : aides-territoires@beta.gouv.fr.

## Endpoints utiles
| Endpoint | Usage |
|---|---|
| `GET /api/aids/` | Recherche paginée (DRF : `page`, `itemsPerPage`, 404 au-delà de la dernière page) |
| `GET /api/aids/by-id/{id}` / `/api/aids/{slug}` | Détail d'une aide |
| `GET /api/themes/`, `GET /api/categories/` | Référentiel thématique **à 2 niveaux** : 8 thèmes → ~90 catégories, avec slugs |
| `GET /api/perimeters/?q=&scale=` | Recherche de périmètres (commune, EPCI, département, région, national…) → `perimeter_id` + code |
| `GET /api/backers/` | Financeurs (pour filtre par financeur) |
| `GET /api/aids/types/`, `/steps/`, `/destinations/`, `/recurrences/` | Référentiels : natures d'aide, avancement projet, actions, récurrence |
| `GET /api/organization-types/` (via index `/api/`) | Types de structures bénéficiaires |

## Paramètres de filtrage de `GET /api/aids/`
- `keyword` : recherche plein texte.
- `organization_type_slugs[]` (ex-`targeted_audiences`) : `association`, `commune`, `epci`, `department`, `region`, `public-org`, `private-sector`, `farmer`, `private-person`… → on utilise déjà `association`.
- `category_slugs[]` : catégories thématiques (niveau fin du référentiel).
- `aid_type_group_slug` / `aid_type_slugs[]` : nature de l'aide — groupe « financière » (subvention, prêt, avance récupérable, cee…) vs « ingénierie » (technique, financière, juridique / `legal-engineering`, `recoverable-advance`…).
- `aid_step_slugs[]` : étape du projet (réflexion, opération, réalisé…).
- `aid_destination_slugs[]` : action financée (investissement, fonctionnement…).
- `aid_recurrence_slug` : `oneoff`, `ongoing`, `recurring`.
- `perimeter_id` (int) ou `perimeter_codes[]` (codes INSEE dépt/commune/EPCI, infra-régional) : filtre géo côté API.
- `european_aid_slug`, `is_charged` (bool), `backer_ids[]`, `backer_group_id`.
- `order_by` : ex. `submission_deadline`, `publication_date`, pertinence.
- Pagination : `page` + `itemsPerPage`.

## Champs de réponse importants (v1.8.4)
- `id`, `slug`, `name`, `description` (HTML), `financers[]`, `categories[]` (libellés « Thème / Catégorie »), `targeted_audiences[]`.
- Géo : `perimeter` (libellé), `perimeter_code`, `region`, `region_code` (ajoutés en v1.8.4 — **on ne les stocke pas encore**).
- Financier : `subvention_rate_lower_bound/upper_bound` (en **%**, pas en €), `subvention_comment`, `loan_amount`, `recoverable_advance_amount`, `other_financial_aid_comment`.
- Cycle de vie : `submission_deadline`, `recurrence`, `is_charged`, `aid_types[]`, `origin_url` / `application_url`.

## État de notre intégration (juillet 2026)
- Sync : `syncAidesTerritoires()` (bouton super-admin + cron `src/app/api/cron/aides-territoires/route.ts`), `targeted_audiences=association`, pagination complète, upsert anti-doublon par `(source, external_id)` dans `grant_opportunities` (Supabase `gzijdwrzcuokvfkpcczr`).
- Aplatissement actuel **avec perte d'information** : `themes[]` = libellés catégories complets, `regions[]` = libellé périmètre brut, `structure_types[]` = toujours vide, montants € = null (taux % relégués dans la description), pas de slugs, pas de codes géo, pas de nature d'aide.
- UI lieu : `/dashboard/[org]/subventions/veille` (`veille-view.tsx`) — profil (`org_grant_profiles`), score `eligibilityScore()` (types.ts), filtres texte/type financeur/thématique (select plat), suivi candidatures (`grant_applications`, statuts intéressé→obtenu, création de convention auto sur « obtenu »), page « Préparer le dossier » avec brouillon IA (`ai-draft.ts`).

## Refonte du tri — implémentée le 2026-07-10

Découpage en 2 couches pour livrer le tri sans dépendre d'une migration/réimport.

**Layer 1 (actif dès déploiement, aucune infra) — corrige le tri :**
- `src/lib/grants/taxonomy.ts` : liste exhaustive des libellés de catégories AT groupés par thème parent (`CATEGORY_GROUPS`), + mapping code postal → région (`regionFromPostalCode`, `DEPARTMENT_TO_REGION`) et helpers de matching géo.
- Le **profil** stocke désormais des **libellés de catégories AT complets** (colonne `org_grant_profile.themes` réutilisée, plus de thèmes maison). Sélecteur à 2 niveaux dans la modale profil.
- `eligibilityScore(opp, profile, orgRegions)` réécrit (types.ts) : thématique 55 pts (intersection exacte + repli thème parent), géo 35 pts (national = partout, sinon match région profil ∪ établissements), fraîcheur/récurrence 10 pts. L'axe « type de structure » supprimé (toutes les aides ciblent l'association → gonflait tout à ~60 %).
- **Multi-lieu** : `getOrgGeoContext(orgId)` (grants/data.ts) dérive les régions des CP des établissements actifs → passées au score. Une aide régionale matche si elle couvre l'une des régions des sites du lieu.
- UI `veille-view.tsx` : select plat de 89 options remplacé par un filtre à facettes (thématiques 2 niveaux, échéance, financeur, nature d'aide) + « compatibles seulement ».

**Layer 2 (optionnelle, précision géo + filtre nature d'aide) :**
- Migration `supabase/migrations/0008_grant_opportunities_at_enrichment.sql` : colonnes `aid_type_slugs`, `is_charged`, `region_code`, `perimeter_scale` + index.
- Import enrichi (aides-territoires.ts) **gardé derrière `AIDES_TERRITOIRES_ENRICH=1`** : off par défaut → import identique à l'existant, zéro risque avant migration.
- Séquence d'activation : appliquer 0008 → `AIDES_TERRITOIRES_ENRICH=1` dans `.env` serveur → redéployer → relancer l'import (bouton super-admin). Le score bascule alors sur `region_code` (géo exacte) et la facette « nature d'aide » apparaît.

## Pièges connus (état AVANT refonte — conservé pour mémoire)
- Les thèmes du profil (`GRANT_THEMES` maison : « Culture », « ESS »…) ne matchent **jamais** les catégories AT (« Nature / environnement / Biodiversité ») → le score thématique est cassé.
- `structure_types` vide sur toutes les aides importées → 25 pts offerts à tout le monde → scores quasi uniformes (~60 %).
- Matching région par égalité de chaînes fragile (périmètres AT = communes, EPCI, massifs, « France », etc.). Utiliser `perimeter_code`/`region_code` + hiérarchie géo.
- `submission_deadline` null = aide permanente (ne pas trier ces aides en fin de liste aveuglément).
- Descriptions HTML → strip déjà en place (limite 2000/4000 chars).
