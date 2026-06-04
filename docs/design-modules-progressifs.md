# Design — Modules progressifs Casa Minga Lieux
> Statut : **IMPLÉMENTÉ** (juin 2026)
> Audit UX F4 — cohérence manifeste + premier contact

## Principe
L'outil grandit avec le lieu. Un nouveau lieu démarre sobre (6 modules), active ses activités
à la création, et découvre les outils avancés quand ses données le justifient.
Philosophie : "sobre, utile, sans formation, rien de superflu, un outil qui s'efface."

## Les 3 couches

### Couche 0 — Socle (toujours actif)
dashboard · demandes · personnes · site-public · equipe · parametres · modules

### Couche 1 — Activités (activées à la création via question "Que fait votre lieu ?")
espaces · reservations · residences · artistes · evenements
adhesions · communaute · finances · factures · documents · communication · mediatheque

### Couche 2 — Avancé (révélé par les données, jamais imposé)
subventions · caisse · gouvernance · impact · partenaires · automatisations

## Règles de sécurité
- Désactiver ne supprime jamais de données — masque seulement de la nav. Réversible.
- Lien direct vers module désactivé → page douce "Module non activé · [L'activer]".
- Suggestion rejetée = définitivement (pas de harcèlement).

## Modèle de données
Table `organization_modules` : organization_id · module_key · enabled · activated_at · activated_by
Seules les couches 1 et 2 sont stockées (le socle est toujours true en dur).

## Migration lieux existants
Détection automatique : si la table principale du module contient ≥ 1 ligne → enabled = true.
Aucun lieu actif ne perd quoi que ce soit.
