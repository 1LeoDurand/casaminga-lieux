"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { sendMail } from "@/lib/mail";
import { tplCompteBienvenue } from "@/lib/mail-templates";
import { ORG_ARCHETYPES } from "@/lib/modules";

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
  orgType?: string; // clé archétype — détermine les modules pré-activés
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
      org_type: params.orgType ?? "autre",
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

  // 2. Pré-activer les modules selon l'archétype choisi
  const archetype = ORG_ARCHETYPES.find((a) => a.key === (params.orgType ?? "autre"))
    ?? ORG_ARCHETYPES.find((a) => a.key === "autre")!;
  if (archetype.modules.length > 0) {
    await admin.from("organization_modules").insert(
      archetype.modules.map((moduleKey) => ({
        organization_id: org.id,
        module_key: moduleKey,
        enabled: true,
      }))
    );
    // Silencieux si erreur (les modules restent désactivés, pas bloquant)
  }

  // 3. Lier user → org (admin)
  const { error: memberErr } = await admin.from("organization_members").insert({
    user_id: params.userId,
    organization_id: org.id,
    role: "admin",
    status: "actif",
  });

  if (memberErr) {
    // Rollback : supprimer l'org créée (modules en cascade)
    await admin.from("organizations").delete().eq("id", org.id);
    return { orgSlug: null, error: "Erreur lors de la liaison du compte à l'organisation." };
  }

  // Email de bienvenue
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
  void sendMail({
    to: params.email,
    subject: `Bienvenue sur Casa Minga Lieux — ${params.name}`,
    html: tplCompteBienvenue({
      orgName: params.name,
      orgSlug: org.slug,
      firstName: params.email.split("@")[0],
      dashboardUrl: `${appUrl}/dashboard/${org.slug}`,
    }),
  });

  return { orgSlug: org.slug, error: null };
}
