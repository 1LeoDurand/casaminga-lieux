"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { verifyPortalToken } from "@/lib/portal/token";
import { notifyOrgAdmins, APP_BASE } from "@/lib/portal/notify";

/**
 * Annulation d'une réservation par son contact, depuis le rappel J-1.
 *
 * Règle « emails actionnables » : ici l'action est directement effective —
 * contrairement à une déclaration de paiement, personne n'a besoin de vérifier
 * qu'une place est bien libre. On écrit donc `annulee` et on prévient l'équipe.
 */
export async function cancelReservationAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("reservationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  const back = `/espace/${token}/reservation/${id}`;

  const email = verifyPortalToken(token);
  if (!email || !id) redirect(`${back}?error=1`);

  const admin = createAdminClient();
  if (!admin) redirect(`${back}?error=1`);

  const { data: resa } = await admin
    .from("reservations")
    .select("id, title, start_at, status, organization_id, person_id, spaces(name), persons(name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!resa) redirect(`${back}?error=1`);

  const person = resa.persons as unknown as { name: string; email: string | null } | null;
  if ((person?.email ?? "").toLowerCase() !== email) redirect(`${back}?error=forbidden`);

  // Idempotent, et on n'annule pas ce qui a déjà eu lieu.
  if (resa.status === "annulee") redirect(`${back}?done=1`);
  if (new Date(resa.start_at) <= new Date()) redirect(`${back}?error=passee`);

  await admin
    .from("reservations")
    .update({
      status: "annulee",
      cancelled_by_client_at: new Date().toISOString(),
      cancellation_reason: reason || null,
    })
    .eq("id", id);

  const spaceName =
    (resa.spaces as unknown as { name: string } | null)?.name ?? resa.title ?? "Espace";

  const { tplReservationAnnuleeParClient } = await import("@/lib/mail-templates");
  await notifyOrgAdmins(admin, resa.organization_id, (org) => ({
    subject: `Réservation annulée — ${person?.name ?? email} (${spaceName})`,
    html: tplReservationAnnuleeParClient({
      orgName: org.name,
      contactName: person?.name ?? email,
      spaceName,
      startAt: resa.start_at,
      reason: reason || null,
      dashboardUrl: `${APP_BASE}/dashboard/${org.slug}/reservations`,
    }),
    category: "reservation",
  }));

  redirect(`${back}?done=1`);
}
