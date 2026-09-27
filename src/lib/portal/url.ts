/**
 * Adresses de l'espace adhérent.
 *
 * Deux portes pour le même jeton :
 *  - « admin » : les pages /espace/<jeton> de cette application ;
 *  - « public » : la page Mon espace de casaminga.com (application statique),
 *    qui lit ses données par GET /api/espace/donnees.
 */

import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import { signPortalToken } from "@/lib/portal/token";

/** D'où vient la demande de lien, donc où le courriel doit renvoyer. */
export type PortalReturn = "public" | "admin";

/**
 * Base des pages /espace. Ce sont des pages de l'admin : elles doivent pointer
 * vers l'admin, pas vers casaminga.com qui est désormais un site statique
 * distinct et ne sert pas ces routes.
 */
export const PORTAL_ADMIN_BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com").replace(/\/$/, "");

/** Base de la page Mon espace du site public. */
const PORTAL_PUBLIC_BASE = PUBLIC_SITE_BASE.replace(/\/$/, "");

/** URL complète de l'espace dans l'admin pour un jeton donné. */
export function portalUrl(token: string): string {
  return `${PORTAL_ADMIN_BASE}/espace/${token}`;
}

/**
 * URL de Mon espace sur casaminga.com. Le jeton va dans le fragment (#), jamais
 * dans le chemin ni la requête : le navigateur ne transmet pas le fragment au
 * serveur, il n'atteint donc ni les journaux d'accès ni l'en-tête Referer.
 */
export function publicPortalUrl(token: string): string {
  return `${PORTAL_PUBLIC_BASE}/mon-espace#${token}`;
}

/** Adresse de l'espace selon la porte d'origine de la demande. */
export function portalUrlFor(token: string, retour: PortalReturn): string {
  return retour === "public" ? publicPortalUrl(token) : portalUrl(token);
}

/** Signe un courriel et renvoie l'URL complète de l'espace (porte admin par défaut). */
export function portalUrlForEmail(email: string, retour: PortalReturn = "admin"): string {
  return portalUrlFor(signPortalToken(email), retour);
}

/** URL de la page de demande de lien (sans jeton). */
export function portalRequestUrl(retour: PortalReturn = "admin"): string {
  return retour === "public" ? `${PORTAL_PUBLIC_BASE}/mon-espace` : `${PORTAL_ADMIN_BASE}/espace`;
}
