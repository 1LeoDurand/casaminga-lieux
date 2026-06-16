import { cookies } from "next/headers";
import type { Establishment } from "@/lib/types";

/** Nom du cookie portant le lieu actif (aligné avec lieuCookieName du LieuSwitcher). */
export function lieuCookieName(orgSlug: string): string {
  return `cm_lieu_${orgSlug}`;
}

/**
 * Lit le lieu sélectionné dans le switcher topbar (cookie) et le valide
 * contre la liste des établissements de l'org. Retourne null pour « Tous les lieux »
 * ou si le cookie pointe sur un établissement inconnu/inactif.
 */
export async function getSelectedLieuId(
  orgSlug: string,
  establishments: Pick<Establishment, "id">[]
): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(lieuCookieName(orgSlug))?.value ?? null;
  if (!raw) return null;
  return establishments.some((e) => e.id === raw) ? raw : null;
}

/**
 * Filtre une liste de lignes par lieu actif.
 * - lieu sélectionné → on ne garde que ce lieu (les lignes non rattachées sont masquées).
 * - « Tous les lieux » (selectedId null) → on garde tout, y compris le non-rattaché.
 */
export function filterByLieu<T extends { establishment_id?: string | null }>(
  rows: T[],
  selectedId: string | null
): T[] {
  if (!selectedId) return rows;
  return rows.filter((r) => r.establishment_id === selectedId);
}
