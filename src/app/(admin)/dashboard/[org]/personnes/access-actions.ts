"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

export interface PermissionSet {
  perm_pilotage: boolean;
  perm_gestion_lieu: boolean;
  perm_structure: boolean;
  perm_publication: boolean;
  perm_systeme: boolean;
}

type AR = { ok: boolean; error?: string };

/** Met à jour les permissions d'un membre (org admin uniquement). */
export async function updatePermissionsAction(
  orgSlug: string,
  orgId: string,
  userId: string,
  perms: PermissionSet
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update(perms)
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/personnes`);
  revalidatePath(`/dashboard/${orgSlug}/personnes/membres`);
  return { ok: true };
}

/**
 * Envoie un lien de réinitialisation de mot de passe à un membre.
 * Génère un magic-link via l'API admin Supabase, puis l'envoie via notre
 * système d'email pour avoir le contrôle sur le template.
 */
export async function sendPasswordResetAction(
  orgSlug: string,
  orgId: string,
  email: string,
  memberName: string
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Configuration serveur manquante." };

  // Générer le lien de récupération (one-time)
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com"}/auth/update-password`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) {
    return { ok: false, error: error?.message ?? "Impossible de générer le lien." };
  }

  const resetLink = data.properties.action_link;

  // Envoyer l'email via notre système
  try {
    const [{ sendMail }, { getOrganizationBySlug }] = await Promise.all([
      import("@/lib/mail"),
      import("@/lib/data"),
    ]);
    const org = await getOrganizationBySlug(orgSlug);
    const firstName = memberName.split(" ")[0];

    await sendMail({
      to: email,
      subject: `Réinitialisation de votre mot de passe — ${org?.name ?? "Casa Minga Lieux"}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2c2c2c">
          <h2 style="color:#2c2c2c">Bonjour ${firstName} 👋</h2>
          <p>Un administrateur de <strong>${org?.name ?? "l'espace"}</strong> a demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
          <a href="${resetLink}"
             style="display:inline-block;background:#FF8A65;color:#fff;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:700;margin:16px 0">
            Réinitialiser mon mot de passe →
          </a>
          <p style="color:#9c9590;font-size:12px">
            Ce lien est à usage unique et expire dans 1 heure.<br>
            Si vous n'étiez pas au courant de cette demande, ignorez cet email — votre mot de passe ne changera pas.
          </p>
        </div>`,
      category: "bienvenue",
      organizationId: orgId,
    });
  } catch (e) {
    console.error("[sendPasswordReset] email non envoyé:", e);
    return { ok: false, error: "Lien généré mais email non envoyé. Contactez le support." };
  }

  return { ok: true };
}
