"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Server action pour créer une organisation et lier l'utilisateur.
 * Utilise la clé service_role (serveur uniquement) pour bypasser la RLS
 * sur la table organizations — opération légitime car c'est une création
 * initiale autorisée par le flow d'inscription.
 */
export async function createOrgAndMember(params: {
  userId: string;
  slug: string;
  name: string;
  structure: string;
  email: string;
}): Promise<{ orgSlug: string | null; error: string | null }> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    return { orgSlug: null, error: "Configuration serveur manquante." };
  }

  const admin = createServiceClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Créer l'organisation
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      slug: params.slug,
      name: params.name,
      structure: params.structure,
      email: params.email,
      plan: "pilot",
    })
    .select("id, slug")
    .single();

  if (orgErr || !org) {
    const msg = orgErr?.message ?? "Erreur inconnue";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { orgSlug: null, error: "Ce nom de lieu est déjà utilisé. Choisissez un autre nom." };
    }
    return { orgSlug: null, error: "Le lieu n'a pas pu être créé." };
  }

  // 2. Lier user → org (admin)
  const { error: memberErr } = await admin.from("organization_members").insert({
    user_id: params.userId,
    organization_id: org.id,
    role: "admin",
    status: "actif",
  });

  if (memberErr) {
    // Rollback : supprimer l'org créée
    await admin.from("organizations").delete().eq("id", org.id);
    return { orgSlug: null, error: "Erreur lors de la liaison du compte à l'organisation." };
  }

  return { orgSlug: org.slug, error: null };
}
