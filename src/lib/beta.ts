/**
 * ──────────────────────────────────────────────────────────────────────────
 *  PHASE BÊTA — tous les modules ouverts, aucune contrainte d'abonnement.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Pendant la bêta, chaque compte voit l'intégralité des modules, quel que
 * soit son tier. La logique de gating (effectiveTier / getEnabledModules /
 * minTier) reste intacte dans le code : elle est simplement court-circuitée
 * par ce flag. Rien n'est supprimé.
 *
 * ▸ À la COMMERCIALISATION, pour réactiver le verrouillage par offre :
 *     - soit passer la constante ci-dessous à `false`,
 *     - soit définir la variable d'env `BETA_OPEN_ALL_MODULES="false"`
 *       (override sans redéploiement de code).
 *
 * Par défaut (aucune env définie) → bêta ouverte. Seule la valeur explicite
 * "false" referme le gating, pour éviter toute fermeture accidentelle.
 */
export const BETA_OPEN_ALL_MODULES =
  process.env.BETA_OPEN_ALL_MODULES !== "false";
