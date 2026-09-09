"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { ROLE_PERMS } from "@/lib/roles";
import type { OrgRole } from "@/lib/roles";

/**
 * Fabrique du client de service : le type dérivé d'elle est concret, là où
 * `ReturnType<typeof createServiceClient>` fait retomber les paramètres
 * génériques sur `never` et rend toute requête inutilisable.
 */
function makeServiceClient(url: string, key: string) {
  return createServiceClient(url, key, { auth: { persistSession: false } });
}
type ServiceClient = ReturnType<typeof makeServiceClient>;

export async function acceptInvitation(params: {
  token: string;
  password: string;
  fullName: string;
}): Promise<{ orgSlug: string | null; error: string | null }> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    return { orgSlug: null, error: "Configuration serveur manquante." };
  }

  const admin = makeServiceClient(SUPABASE_URL, serviceRoleKey);

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
  const perms = ROLE_PERMS[inv.role as OrgRole] ?? ROLE_PERMS.readonly;

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

  // 5. Si cette invitation venait d'une revendication, le lieu change de statut.
  const slugFinal = await cloreRevendication(admin, inv.id, org);

  // L'invitation a été marquée utilisée dès l'étape 1 (revendication atomique).
  return { orgSlug: slugFinal, error: null };
}

/**
 * Clôt une revendication, si l'invitation en venait d'une.
 *
 * C'est ici et nulle part ailleurs que le lieu devient « revendiqué » : ni au
 * dépôt de la demande, ni à l'arbitrage. Tant que personne n'a créé de compte,
 * rien n'est acquis, et une invitation jamais ouverte doit laisser la fiche
 * exactement dans l'état où elle était.
 *
 * Renvoie le slug à utiliser pour la redirection — il peut avoir changé.
 */
async function cloreRevendication(
  admin: ServiceClient,
  invitationId: string,
  org: { id: string; slug: string; name: string }
): Promise<string> {
  const { data: claim } = await admin
    .from("claims")
    .select("id")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (!claim) return org.slug;

  /**
   * Le slug perd son préfixe d'import.
   *
   * Il devient une URL publique au moment de la revendication : la vitrine
   * s'ouvre, et `casaminga.com/import-college-des-ecossais` serait un aveu de
   * plomberie sur la page d'un lieu qui vient de nous faire confiance. Rien ne
   * casse : tant que la fiche était moissonnée, cette adresse renvoyait
   * « introuvable » et portait un noindex, donc aucun lien légitime n'y mène.
   * Les fiches d'événement, elles, sont adressées par identifiant.
   *
   * `public_sites` porte son propre slug, que le proxy des domaines
   * personnalisés utilise : les deux se renomment ensemble, ou pas du tout.
   *
   * En cas de collision avec un lieu déjà présent, on garde le slug d'origine :
   * une URL laide vaut mieux qu'une organisation qui en écrase une autre.
   */
  let slug = org.slug;
  const nu = org.slug.replace(/^import-/, "");
  if (nu !== org.slug) {
    const [{ data: prisOrg }, { data: prisSite }] = await Promise.all([
      admin.from("organizations").select("id").eq("slug", nu).maybeSingle(),
      admin.from("public_sites").select("id").eq("slug", nu).maybeSingle(),
    ]);
    if (!prisOrg && !prisSite) {
      const { error } = await admin
        .from("organizations")
        .update({ slug: nu })
        .eq("id", org.id);
      if (!error) {
        slug = nu;
        // Si celui-ci échoue, les deux tables divergent : la vitrine reste
        // servie par l'organisation, seule la résolution d'un domaine
        // personnalisé en pâtirait, et le lieu n'en a pas encore.
        await admin
          .from("public_sites")
          .update({ slug: nu })
          .eq("organization_id", org.id);
      }
    }
  }

  await admin
    .from("organizations")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", org.id)
    .is("claimed_at", null);

  await admin.from("claims").update({ status: "accepte" }).eq("id", claim.id);

  return slug;
}
