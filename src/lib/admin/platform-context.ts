/**
 * Lecture serveur du contexte de plateforme choisi dans /admin.
 *
 * Ordre de priorité : `?plateforme=` dans l'URL courante, sinon le cookie
 * posé par le sélecteur (`admin-platform-actions.ts`), sinon "admin" par
 * défaut. Une valeur inconnue est ignorée à chaque étage plutôt que de faire
 * planter la page.
 *
 * N'importe pas depuis un composant client : `next/headers` y est interdit.
 */

import { cookies } from "next/headers";
import { isAdminPlatform, type AdminPlatform } from "./platforms";

export const ADMIN_PLATFORM_COOKIE = "admin_platform";

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams | undefined;

function readParam(searchParams: SearchParamsLike, key: string): string | undefined {
  if (!searchParams) return undefined;
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export async function getAdminPlatform(searchParams?: SearchParamsLike): Promise<AdminPlatform> {
  const fromQuery = readParam(searchParams, "plateforme");
  if (isAdminPlatform(fromQuery)) return fromQuery;

  const store = await cookies();
  const fromCookie = store.get(ADMIN_PLATFORM_COOKIE)?.value;
  if (isAdminPlatform(fromCookie)) return fromCookie;

  return "admin";
}
