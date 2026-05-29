import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Client Supabase pour Server Components, Route Handlers et Server Actions.
 * Lit/écrit la session via les cookies. Clé publique anon uniquement —
 * l'isolation des données repose sur les politiques RLS Postgres.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appelé depuis un Server Component : ignoré, le refresh de session
          // est géré par le middleware.
        }
      },
    },
  });
}
