import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware Next.js — appelé sur chaque requête.
 * Rafraîchit le token Supabase dans les cookies pour que
 * les Server Components et Server Actions aient toujours une session valide.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * On exclut les fichiers statiques et les images optimisées Next.js.
     * Toutes les autres routes passent par le middleware (refresh session).
     */
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
