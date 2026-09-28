"use server";

import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { ADMIN_PLATFORM_COOKIE } from "@/lib/admin/platform-context";
import { isAdminPlatform, type AdminPlatform } from "@/lib/admin/platforms";

/**
 * Persiste le choix de plateforme du sélecteur de la barre latérale, pour que
 * la prochaine visite sur /admin sans `?plateforme=` retombe dessus plutôt
 * que sur "admin" par défaut. `path: "/admin"` : le cookie n'a de sens que
 * là, `sameSite: "lax"` suffit (pas de secret), `secure` seulement en prod
 * (le slot Infomaniak est HTTPS, un essai local ne l'est pas forcément).
 */
export async function setAdminPlatform(platform: AdminPlatform): Promise<{ ok: boolean }> {
  await requireSuperAdmin();
  if (!isAdminPlatform(platform)) return { ok: false };

  const store = await cookies();
  store.set(ADMIN_PLATFORM_COOKIE, platform, {
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true };
}
