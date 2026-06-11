"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { SiteContent } from "@/lib/site-public/types";

type Result = { ok: boolean; error?: string };

export async function saveSiteConfig(
  orgId: string,
  orgSlug: string,
  payload: {
    title: string;
    seo_description: string | null;
    status: "brouillon" | "publie";
    content: SiteContent;
  }
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();

  const row = {
    organization_id: orgId,
    slug: orgSlug,
    title: payload.title,
    seo_description: payload.seo_description,
    status: payload.status,
    content_blocks: payload.content,
    published_at: payload.status === "publie" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("public_sites")
    .upsert(row, { onConflict: "organization_id" });

  if (error) {
    console.error("saveSiteConfig:", error);
    return { ok: false, error: humanError(error) };
  }

  revalidatePath(`/dashboard/${orgSlug}/site-public`);
  revalidatePath(`/site/${orgSlug}`);
  return { ok: true };
}

// ── Domaine personnalisé (phase 1 : activation manuelle Infomaniak) ──────────

export interface CustomDomainState {
  domain: string | null;
  status: "pending_dns" | "verified" | "active" | null;
  token: string | null;
}

/** hostname valide, minuscule, sans schéma — et jamais un domaine casaminga. */
function normalizeDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d)) return null;
  if (d === "casaminga.com" || d.endsWith(".casaminga.com")) return null;
  return d;
}

export async function getCustomDomainState(orgId: string): Promise<CustomDomainState> {
  if (!isSupabaseConfigured()) return { domain: null, status: null, token: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("custom_domain, custom_domain_status, custom_domain_token")
    .eq("organization_id", orgId)
    .maybeSingle();
  return {
    domain: data?.custom_domain ?? null,
    status: (data?.custom_domain_status as CustomDomainState["status"]) ?? null,
    token: data?.custom_domain_token ?? null,
  };
}

/** Enregistre la demande de domaine et génère le token TXT. */
export async function requestCustomDomainAction(
  orgId: string,
  orgSlug: string,
  rawDomain: string
): Promise<Result & { token?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };

  const domain = normalizeDomain(rawDomain);
  if (!domain) return { ok: false, error: "Nom de domaine invalide (ex. attendu : monlieu.fr)." };

  const supabase = await createClient();
  const token = `casaminga-verify-${crypto.randomUUID()}`;

  const { error } = await supabase
    .from("public_sites")
    .update({
      custom_domain: domain,
      custom_domain_status: "pending_dns",
      custom_domain_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);

  if (error) {
    // Collision d'unicité = domaine déjà revendiqué par une autre org
    if (error.code === "23505") return { ok: false, error: "Ce domaine est déjà utilisé par un autre lieu." };
    return { ok: false, error: humanError(error) };
  }

  revalidatePath(`/dashboard/${orgSlug}/site-public`);
  return { ok: true, token };
}

/** Vérifie l'enregistrement TXT _casaminga.<domaine> et notifie Léo si OK. */
export async function verifyCustomDomainAction(
  orgId: string,
  orgSlug: string
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();

  const { data } = await supabase
    .from("public_sites")
    .select("custom_domain, custom_domain_status, custom_domain_token")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!data?.custom_domain || !data.custom_domain_token) {
    return { ok: false, error: "Aucun domaine en attente de vérification." };
  }
  if (data.custom_domain_status === "active") return { ok: true };

  // Lookup TXT (Node runtime)
  let records: string[][] = [];
  try {
    const { resolveTxt } = await import("node:dns/promises");
    records = await resolveTxt(`_casaminga.${data.custom_domain}`);
  } catch {
    return {
      ok: false,
      error: "Enregistrement TXT introuvable. La propagation DNS peut prendre jusqu'à 1 h — réessayez plus tard.",
    };
  }

  const found = records.flat().some((r) => r.trim() === data.custom_domain_token);
  if (!found) {
    return { ok: false, error: "L'enregistrement TXT existe mais ne correspond pas au code attendu." };
  }

  await supabase
    .from("public_sites")
    .update({ custom_domain_status: "verified", updated_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  // Notifier Léo pour l'activation manuelle (alias + SSL Infomaniak)
  try {
    const { sendMail, adminEmail } = await import("@/lib/mail");
    await sendMail({
      to: adminEmail(),
      subject: `⚙️ Domaine à activer : ${data.custom_domain} (${orgSlug})`,
      html: `<p>Le lieu <strong>${orgSlug}</strong> a vérifié la propriété de
        <strong>${data.custom_domain}</strong>.</p>
        <p>À faire dans la console Infomaniak : ajouter l'alias + certificat SSL,
        puis activer le domaine depuis /admin/organisations.</p>`,
      category: "custom-domain",
      organizationId: orgId,
    });
  } catch { /* best-effort */ }

  revalidatePath(`/dashboard/${orgSlug}/site-public`);
  return { ok: true };
}

/**
 * Active le domaine (réservé super-admin, après ajout de l'alias dans Infomaniak).
 * Phase 1 manuelle : Léo reçoit l'email « domaine à activer », configure
 * Infomaniak, puis clique Activer.
 */
export async function activateCustomDomainAction(orgId: string): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { isSuperAdminEmail, createAdminClient } = await import("@/lib/admin/guard");
  if (!user || !isSuperAdminEmail(user.email)) {
    return { ok: false, error: "Action réservée à l'équipe Casa Minga." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Client admin indisponible." };

  const { data } = await admin
    .from("public_sites")
    .select("custom_domain, custom_domain_status")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data?.custom_domain || data.custom_domain_status !== "verified") {
    return { ok: false, error: "Le domaine doit d'abord être vérifié (TXT) par le lieu." };
  }

  const { error } = await admin
    .from("public_sites")
    .update({ custom_domain_status: "active", updated_at: new Date().toISOString() })
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: humanError(error) };
  return { ok: true };
}

/** Supprime le domaine personnalisé (retour au site casaminga.com/<slug>). */
export async function removeCustomDomainAction(
  orgId: string,
  orgSlug: string
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_sites")
    .update({
      custom_domain: null,
      custom_domain_status: null,
      custom_domain_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/site-public`);
  return { ok: true };
}
