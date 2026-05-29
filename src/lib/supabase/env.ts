/**
 * Lecture centralisée des variables Supabase côté front.
 * SEULES les clés publiques (URL + anon) sont lues ici.
 * La clé service_role n'est JAMAIS importée dans ce module ni dans le bundle client.
 */

const PLACEHOLDERS = [
  "À_REMPLACER_PAR_L_URL_SUPABASE",
  "À_REMPLACER_PAR_LA_CLÉ_PUBLIQUE_ANON",
  "",
  undefined,
];

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Indique si de vraies valeurs Supabase ont été fournies.
 * Tant que c'est `false`, l'app fonctionne sur les données de démo (seed)
 * et n'effectue aucun appel réseau Supabase.
 */
export function isSupabaseConfigured(): boolean {
  return (
    !PLACEHOLDERS.includes(SUPABASE_URL) &&
    !PLACEHOLDERS.includes(SUPABASE_ANON_KEY)
  );
}
