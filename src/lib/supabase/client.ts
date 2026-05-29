import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Client Supabase pour les Client Components (navigateur).
 * Utilise exclusivement la clé publique anon.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
