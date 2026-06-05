"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

export async function acceptInvitation(params: {
  token: string;
  password: string;
  fullName: string;
}): Promise<{ orgSlug: string | null; error: string | null }> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    return { orgSlug: null, error: "Configuration serveur manquante." };
  }

  const admin = createServiceClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Vérifier l'invitation
  const { data: inv, error: invErr } = await admin
    .from("invitations")
    .select("id, organization_id, email, role, expires_at, used_at")
    .eq("token", params.token)
    .maybeSingle();

  if (invErr || !inv) return { orgSlug: null, error: "Lien d'invitation invalide." };
  if (inv.used_at) return { orgSlug: null, error: "Ce lien a déjà été utilisé." };
  if (new Date(inv.expires_at) < new Date()) return { orgSlug: null, error: "Ce lien a expiré." };

  // 2. Récupérer le slug de l'org
  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name")
    .eq("id", inv.organization_id)
    .single();

  if (!org) return { orgSlug: null, error: "Organisation introuvable." };

  // 3. Créer le compte Supabase Auth (ou récupérer l'existant)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password: params.password,
    user_metadata: { full_name: params.fullName },
    email_confirm: true, // confirme l'email directement (invitation = preuve)
  });

  let userId: string;

  if (authErr) {
    // Peut-être que l'utilisateur existe déjà — on le cherche
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email === inv.email);
    if (!found) return { orgSlug: null, error: "Impossible de créer le compte : " + authErr.message };
    userId = found.id;
  } else {
    userId = created.user.id;
  }

  // 4. Ajouter à l'org (idempotent)
  const { error: memberErr } = await admin.from("organization_members").upsert(
    {
      user_id: userId,
      organization_id: inv.organization_id,
      role: inv.role,
      status: "actif",
    },
    { onConflict: "user_id,organization_id" }
  );

  if (memberErr) return { orgSlug: null, error: "Erreur lors de l'ajout à l'organisation." };

  // 5. Marquer l'invitation comme utilisée
  await admin.from("invitations").update({ used_at: new Date().toISOString() }).eq("token", params.token);

  return { orgSlug: org.slug, error: null };
}
