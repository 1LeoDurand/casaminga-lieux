/**
 * Helpers URL pour le portail adhérent.
 * L'espace membre est hébergé sur le domaine public (casaminga.com), pas admin.
 */

import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import { signPortalToken } from "@/lib/portal/token";

/** URL complète du portail pour un token donné. */
export function portalUrl(token: string): string {
  return `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/espace/${token}`;
}

/** Signe un email et retourne l'URL complète du portail. */
export function portalUrlForEmail(email: string): string {
  const token = signPortalToken(email);
  return portalUrl(token);
}

/** URL de la page de demande de lien (sans token). */
export function portalRequestUrl(): string {
  return `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/espace`;
}
