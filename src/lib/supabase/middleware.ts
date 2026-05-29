import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Rafraîchit la session Supabase à chaque requête et la propage via cookies.
 * Tant que Supabase n'est pas configuré (placeholders .env), aucun appel
 * réseau n'est effectué — l'app tourne sur les données de démo.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Important : ne rien insérer entre createServerClient et getUser().
  await supabase.auth.getUser();

  return response;
}
