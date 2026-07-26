"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { verifyPortalToken } from "@/lib/portal/token";
import { notifyOrgAdmins, APP_BASE } from "@/lib/portal/notify";

/**
 * L'adhérent déclare son intention depuis le rappel J-30 (lien signé, sans compte).
 *
 * Règle « emails actionnables » : l'intention COUPE les rappels et PRÉVIENT
 * l'équipe. Elle ne change pas le statut de l'adhésion — « je renouvelle » n'est
 * pas un renouvellement, seul le passage par le tunnel (ou une saisie manuelle)
 * en crée un. Voir src/app/api/cron/reminders/route.ts.
 */
export async function declareRenewalIntentAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("adhesionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const back = `/espace/${token}/adhesion/${id}`;
  if (intent !== "renouvelle" && intent !== "ne_renouvelle_pas") redirect(`${back}?error=1`);

  const email = verifyPortalToken(token);
  if (!email || !id) redirect(`${back}?error=1`);

  const admin = createAdminClient();
  if (!admin) redirect(`${back}?error=1`);

  const { data: app } = await admin
    .from("membership_applications")
    .select("id, first_name, last_name, email, membership_end, organization_id, renewal_intent_at")
    .eq("id", id)
    .maybeSingle();

  if (!app) redirect(`${back}?error=1`);

  // L'adhésion doit appartenir au porteur du token.
  if ((app.email ?? "").toLowerCase() !== email) redirect(`${back}?error=forbidden`);

  // Idempotent : intention déjà déclarée → écran de confirmation.
  if (app.renewal_intent_at) redirect(`${back}?done=1`);

  await admin
    .from("membership_applications")
    .update({
      renewal_intent: intent,
      renewal_intent_at: new Date().toISOString(),
      renewal_intent_note: note || null,
    })
    .eq("id", id);

  // Seul le non-renouvellement mérite une alerte : « je renouvelle » se verra
  // arriver tout seul par le tunnel d'adhésion.
  if (intent === "ne_renouvelle_pas") {
    const memberName = [app.first_name, app.last_name].filter(Boolean).join(" ") || (app.email ?? "Un adhérent");
    const { tplAdhesionNonRenouvellement } = await import("@/lib/mail-templates");
    await notifyOrgAdmins(admin, app.organization_id, (org) => ({
      subject: `Non-renouvellement — ${memberName}`,
      html: tplAdhesionNonRenouvellement({
        orgName: org.name,
        memberName,
        memberEmail: app.email ?? "—",
        membershipEnd: app.membership_end
          ? new Date(app.membership_end).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "long", year: "numeric",
            })
          : "—",
        note: note || null,
        dashboardUrl: `${APP_BASE}/dashboard/${org.slug}/adhesions`,
      }),
      category: "adhesion",
    }));
  }

  redirect(`${back}?done=1`);
}
