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

  // 1. Revendiquer l'invitation ATOMIQUEMENT (un seul UPDATE conditionnel) :
  //    deux requêtes simultanées avec le même token ne peuvent pas passer
  //    toutes les deux. En cas d'échec plus loin, on restitue le token.
  const { data: claimed } = await admin
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("token", params.token)
    .is("used_at", null)
    .select("id, organization_id, email, role, expires_at")
    .maybeSingle();

  if (!claimed) return { orgSlug: null, error: "Lien d'invitation invalide ou déjà utilisé." };
  const inv = claimed;
  const releaseInvitation = () =>
    admin.from("invitations").update({ used_at: null }).eq("id", inv.id);

  if (new Date(inv.expires_at) < new Date()) {
    await releaseInvitation();
    return { orgSlug: null, error: "Ce lien a expiré." };
  }

  // 2. Récupérer le slug de l'org
  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name")
    .eq("id", inv.organization_id)
    .single();

  if (!org) {
    await releaseInvitation();
    return { orgSlug: null, error: "Organisation introuvable." };
  }

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
    if (!found) {
      await releaseInvitation();
      return { orgSlug: null, error: "Impossible de créer le compte : " + authErr.message };
    }
    userId = found.id;
  } else {
    userId = created.user.id;
  }

  // Permissions pré-configurées selon le rôle
  const ROLE_PERMS: Record<string, Record<string, boolean>> = {
    admin:       { perm_pilotage: true,  perm_gestion_lieu: true,  perm_structure: true,  perm_publication: true,  perm_systeme: true  },
    coord:       { perm_pilotage: true,  perm_gestion_lieu: true,  perm_structure: false, perm_publication: true,  perm_systeme: false },
    finance:     { perm_pilotage: true,  perm_gestion_lieu: false, perm_structure: true,  perm_publication: false, perm_systeme: true  },
    comm:        { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: true,  perm_systeme: false },
    benevole:    { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: false, perm_systeme: false },
    intervenant: { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: false, perm_systeme: false },
    readonly:    { perm_pilotage: false, perm_gestion_lieu: false, perm_structure: false, perm_publication: false, perm_systeme: false },
  };
  const perms = ROLE_PERMS[inv.role as string] ?? ROLE_PERMS.readonly;

  // 4. Ajouter à l'org (idempotent)
  const { error: memberErr } = await admin.from("organization_members").upsert(
    {
      user_id: userId,
      organization_id: inv.organization_id,
      role: inv.role,
      status: "actif",
      ...perms,
    },
    { onConflict: "user_id,organization_id" }
  );

  if (memberErr) {
    await releaseInvitation();
    return { orgSlug: null, error: "Erreur lors de l'ajout à l'organisation." };
  }

  // L'invitation a été marquée utilisée dès l'étape 1 (revendication atomique).
  return { orgSlug: org.slug, error: null };
}
