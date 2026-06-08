"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

/**
 * Validation publique d'une tâche par son assigné·e via lien magic-link.
 * Aucune authentification : on s'appuie sur le caractère secret du token.
 * Service-role (RLS contournée) car l'assigné·e n'est pas forcément un compte.
 */
export async function validateTaskByToken(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect(`/tache/invalide`);

  const admin = createAdminClient();
  if (!admin) redirect(`/tache/${token}?error=1`);

  const { data: task } = await admin
    .from("tasks")
    .select("id, title, status, validated_at, organization_id, assignee_id")
    .eq("validation_token", token)
    .maybeSingle();

  if (!task) redirect(`/tache/${token}?error=1`);

  // Idempotent : déjà validée → on renvoie simplement vers l'écran de confirmation
  if (task.validated_at) redirect(`/tache/${token}?done=1`);

  const now = new Date().toISOString();
  await admin.from("tasks").update({ status: "fait", validated_at: now }).eq("id", task.id);

  // ── Notifier les coordinateurs (admins actifs de l'org) ──
  try {
    const [{ data: person }, { data: org }, { data: members }] = await Promise.all([
      admin.from("persons").select("name").eq("id", task.assignee_id!).maybeSingle(),
      admin.from("organizations").select("name, slug").eq("id", task.organization_id).maybeSingle(),
      admin
        .from("organization_members")
        .select("profiles(email)")
        .eq("organization_id", task.organization_id)
        .eq("role", "admin")
        .eq("status", "actif"),
    ]);

    const emails = (members ?? [])
      .map((m) => (m.profiles as unknown as { email: string | null } | null)?.email)
      .filter((e): e is string => !!e);

    if (emails.length > 0) {
      const { sendMail } = await import("@/lib/mail");
      const { tplTacheValidee } = await import("@/lib/mail-templates");
      await sendMail({
        to: emails,
        subject: `Tâche terminée : ${task.title}`,
        html: tplTacheValidee({
          orgName: org?.name ?? "Votre lieu",
          assigneeName: person?.name ?? "L'assigné·e",
          title: task.title,
          dashboardUrl: `${APP_BASE}/dashboard/${org?.slug ?? ""}/taches`,
        }),
        category: "tache",
        organizationId: task.organization_id,
      });
    }
  } catch {
    /* la notification ne doit jamais bloquer la validation */
  }

  redirect(`/tache/${token}?done=1`);
}
