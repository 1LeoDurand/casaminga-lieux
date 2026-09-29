"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { resolveContactToken } from "@/lib/outreach/link-token";
import { optOutContact } from "@/lib/outreach/optout";

/**
 * Bouton de secours de la page « ne plus m'écrire » (JavaScript absent ou
 * appel automatique en échec). Même effet que POST /api/contact/<jeton>/stop.
 */
export async function stopAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").slice(0, 256);
  const page = `/contact/${encodeURIComponent(token)}/stop`;

  const link = await resolveContactToken(token, "stop", { skipRateLimit: true });
  if (!link) redirect(page);

  let ok = false;
  try {
    const admin = createAdminClient();
    if (admin) {
      await optOutContact(admin, {
        contactId: link.contact.id,
        threadId: link.thread.id,
        source: "lien",
        via: "page",
      });
      ok = true;
    }
  } catch {
    console.error("[contact] opt-out failed after a valid token");
  }
  redirect(`${page}?r=${ok ? "ok" : "server"}`);
}
