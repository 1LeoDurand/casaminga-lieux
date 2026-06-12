import "server-only";

/**
 * Rate-limiting en mémoire (fenêtre glissante simplifiée).
 *
 * Suffisant pour un déploiement mono-instance (Infomaniak Node) : protège les
 * surfaces publiques contre le spam d'emails et l'énumération, sans dépendance
 * Redis. Si l'app passe en multi-instances, remplacer par un store partagé.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

// Nettoyage paresseux pour éviter la croissance infinie de la Map
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Retourne true si l'appel est autorisé (et le compte), false si la limite
 * est atteinte pour cette clé sur la fenêtre donnée.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}
