/**
 * Écriture des événements de suivi.
 *
 * Ces routes sont appelées par le client mail du destinataire, qui n'a aucune
 * session : d'où le client service_role, borné à l'insertion dans
 * `newsletter_events` après vérification que le jeton correspond bien à une
 * ligne de livraison existante.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

/**
 * Enregistre une ouverture ou un clic. Silencieux en cas d'échec : aucune de
 * ces routes ne doit renvoyer d'erreur au destinataire pour un problème de
 * mesure.
 */
export async function recordEvent(
  deliveryId: string,
  type: "ouverture" | "clic",
  url?: string
): Promise<void> {
  // Filtre de forme avant toute requête : sans lui, chaque URL malformée
  // deviendrait une requête en base.
  if (!UUID_RE.test(deliveryId)) return;
  const db = admin();
  if (!db) return;

  const { data: delivery } = await db
    .from("newsletter_deliveries")
    .select("id, campaign_id")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return;

  await db.from("newsletter_events").insert({
    delivery_id: delivery.id,
    campaign_id: delivery.campaign_id,
    type,
    url: url ?? null,
  });
}
