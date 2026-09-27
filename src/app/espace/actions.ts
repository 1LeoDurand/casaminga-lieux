"use server";

import { requestPortalLink } from "@/lib/portal/request-link";

/**
 * Demande de lien espace adhérent depuis le formulaire /espace de l'admin.
 * Renvoie TOUJOURS { ok: true } (anti-énumération), même si le courriel est
 * inconnu. La logique vit dans requestPortalLink, partagée avec
 * POST /api/espace/lien pour que les deux portes se comportent pareil.
 */
export async function requestPortalLinkAction(
  _prev: { ok: boolean },
  formData: FormData
): Promise<{ ok: boolean }> {
  try {
    await requestPortalLink(formData.get("email"), "admin");
  } catch {
    // Même réponse en cas de panne : une erreur visible trahirait un dossier existant.
  }
  return { ok: true };
}
