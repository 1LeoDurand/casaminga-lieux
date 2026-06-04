/**
 * Traduit une erreur Postgres/Supabase en message lisible par un bénévole.
 * Le code d'erreur Postgres reste loggué côté serveur (console.error).
 * Ne jamais afficher error.message brut à l'utilisateur final.
 */
export function humanError(e: { code?: string; message?: string } | null | undefined): string {
  switch (e?.code) {
    case "42501": return "Vous n'avez pas accès à cette ressource.";
    case "23505": return "Cet élément existe déjà (doublon).";
    case "23503": return "Un élément lié est manquant ou a été supprimé.";
    case "23502": return "Un champ obligatoire n'est pas rempli.";
    case "22P02": return "Une valeur est mal formatée.";
    case "PGRST116": return "Aucun résultat trouvé.";
    default:      return "Une erreur est survenue. Réessayez dans un instant.";
  }
}
