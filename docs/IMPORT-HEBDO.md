# Import hebdomadaire des sources d'événements

Workflow GitHub Actions : `.github/workflows/import-hebdo.yml`. Relance
automatique de l'analyse `ANALYSE-SOURCES-EVENEMENTS.md` (§ 4.F), écrite au
prompt 2.5 de la cascade `LISTE-D-ATTENTE.md`.

## Ce qu'il fait

Trois étapes, dans l'ordre, chacune chronométrée et résumée dans l'onglet
Actions du run (résumé de job, colonne de droite) :

1. `scripts/rapprocher-annuaire-openagenda.py` : régénère la liste blanche
   des tiers-lieux rapprochés d'un lieu OpenAgenda
   (`scripts/data/lieux-annuaire-openagenda.json`). Ce fichier est réécrit
   dans la copie de travail éphémère du run, jamais commité : le workflow ne
   fait ni `git add` ni `git commit` ni `git push`, nulle part.
2. `scripts/import-openagenda.py --lieux ... --essai` : compte ce qui serait
   importé depuis OpenAgenda national, sans rien écrire. Si le mode est réel
   (voir plus bas), un second passage sans `--essai` importe réellement, avec
   `--max 300` : au plus 300 nouveaux événements par run, pour ne jamais
   noyer l'agenda public d'un coup si la liste blanche grossit beaucoup d'une
   semaine à l'autre.
3. `scripts/import-sites.py --essai` : sonde les sites des tiers-lieux de
   l'annuaire (API The Events Calendar, ICS, JSON-LD), sans rien écrire. Même
   principe en mode réel : un second passage avec `--max 300`. Le script
   saute de lui-même les sites déjà sondés il y a moins de 90 jours et restés
   muets (`annuaire_sites_sondes`) : un run ne resonde donc jamais tout
   l'annuaire, seulement ce qui n'a pas été essayé récemment ou ce qui avait
   donné un signal.

Une fiche importée n'est jamais mise en avant : `portal_status = 'pending'`
sur tout ce qui est écrit par ces deux scripts, comme en local.

## Mode essai ou réel

- **Déclenchement manuel** (`Actions` → `Import hebdomadaire...` → `Run
  workflow`) : une case à cocher `essai`, cochée par défaut. Cochée = rien
  n'est écrit, seulement les comptes. Décochée = import réel plafonné à 300
  par source.
- **Déclenchement automatique** (cron, chaque lundi) : toujours en mode réel
  plafonné. C'est le but de la relance hebdomadaire ; l'essai manuel sert à
  vérifier avant d'activer le cron, ou à contrôler un doute sans rien écrire.

## Activer le workflow : les deux secrets à créer

Le workflow échoue volontairement, dès sa première étape utile, tant que ces
deux secrets n'existent pas (message clair dans les logs et dans le résumé
du run) :

| Secret | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gzijdwrzcuokvfkpcczr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé de service (`service_role`), jamais la clé anon |

À créer dans le dépôt GitHub `casaminga-lieux` : Settings → Secrets and
variables → Actions → New repository secret. Ce sont les deux mêmes noms que
lit `.env.local` en local (`load_env()` dans `scripts/import_commun.py`,
`scripts/import-openagenda.py` et `scripts/rapprocher-annuaire-openagenda.py`) :
les trois scripts lisent d'abord `.env.local` s'il existe (comportement local
inchangé), et à défaut les variables d'environnement du processus, ce que
GitHub Actions fournit via ces secrets. Aucune valeur n'est jamais affichée
ni loguée par le workflow ou par les scripts.

## Lancer le workflow à la main

Onglet **Actions** du dépôt → **Import hebdomadaire — sources
d'événements** → **Run workflow**. Laisser la case `essai` cochée pour un
premier essai sans rien écrire ; la décocher seulement une fois le résultat
de l'essai relu.

## Lire le résumé

Chaque run affiche, dans l'onglet **Summary** de sa page (pas seulement dans
les logs de chaque étape) : le mode (essai ou réel), puis la sortie complète
de chacun des trois scripts (mêmes lignes qu'un lancement local : comptes par
type, doublons écartés, événements masqués par exclusion éditoriale, temps
passé). C'est la même lecture qu'un rapport de cascade : rien à recalculer à
la main.

## Ce qui est plafonné, et pourquoi

- `--max 300` sur les deux imports réels : un run ne peut jamais écrire plus
  de 300 événements OpenAgenda et 300 événements de sites, quelle que soit la
  taille de ce qui reste à importer. Objectif : un pic (nouvelle liste
  blanche beaucoup plus large, ou nouveaux sites qui répondent tous d'un
  coup) s'étale sur plusieurs lundis plutôt que de charger l'agenda public
  d'un coup et sans relecture éditoriale possible entre-temps.
- Le moissonneur de sites ne resonde pas un site resté muet il y a moins de
  90 jours (règle du script lui-même, pas du workflow) : un run hebdomadaire
  n'inspecte donc en pratique qu'une fraction de l'annuaire à chaque fois.
- Le workflow entier a un délai maximum de 90 minutes (`timeout-minutes`) :
  au-delà, GitHub Actions arrête le run de force plutôt que de le laisser
  tourner indéfiniment.
- `concurrency: import-hebdo` : un seul run à la fois. Un déclenchement manuel
  pendant que le cron tourne encore attend que celui-ci se termine plutôt que
  de s'exécuter en parallèle (les deux liraient et écriraient le même état de
  base).

## Couper le workflow

- Un seul run en cours : l'annuler depuis l'onglet Actions (bouton
  **Cancel workflow**) n'écrit rien de plus que ce qui était déjà passé.
- Le désactiver durablement : onglet Actions → **Import hebdomadaire...** →
  menu **···** → **Disable workflow**. Le cron ne se déclenche plus ; le
  déclenchement manuel reste possible tant qu'il n'est pas réactivé.
- Le retirer complètement : supprimer `.github/workflows/import-hebdo.yml`
  (aucune donnée en base n'en dépend, seule la relance automatique s'arrête).
