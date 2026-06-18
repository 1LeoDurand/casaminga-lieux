import { redirect } from "next/navigation";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrgRole } from "@/lib/roles";

/**
 * Liste des emails super-admin (propriétaires de la plateforme).
 * Ces comptes ont accès au back-office /admin (toutes les organisations).
 *
 * Extensible via la variable d'env SUPER_ADMIN_EMAILS (séparés par des virgules)
 * sans avoir à redéployer le code.
 */
const HARDCODED_SUPER_ADMINS = ["ecommunication@etik.com"];

export function superAdminEmails(): string[] {
  const fromEnv = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...HARDCODED_SUPER_ADMINS.map((e) => e.toLowerCase()), ...fromEnv])];
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

/**
 * Garde à appeler en tête de chaque page /admin.
 * - Si Supabase n'est pas configuré → renvoie un drapeau (mode démo, pas d'auth réelle).
 * - Si l'utilisateur n'est pas connecté ou pas super-admin → redirige vers /login.
 * Retourne l'email du super-admin connecté.
 */
export async function requireSuperAdmin(): Promise<{ email: string; demo: boolean }> {
  if (!isSupabaseConfigured()) {
    // En démo (pas de backend), on laisse passer pour pouvoir prévisualiser l'UI.
    return { email: "démo@casaminga.com", demo: true };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  if (!isSuperAdminEmail(email)) {
    redirect("/login");
  }

  return { email: email as string, demo: false };
}

/**
 * Retourne le rôle de l'utilisateur courant dans une organisation donnée.
 * "super" = super-admin plateforme, null = non connecté ou pas membre.
 */
export async function getCallerOrgRole(orgId: string): Promise<OrgRole | "super" | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  if (!email) return null;
  if (isSuperAdminEmail(email)) return "super";
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", data.user!.id)
    .eq("status", "actif")
    .maybeSingle();
  return (member?.role as OrgRole) ?? null;
}

/**
 * Vérifie que l'appelant est admin de l'org ou super-admin plateforme.
 * À utiliser dans les server actions sensibles (invitations, changement de rôle…).
 */
export async function assertOrgAdmin(orgId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = await getCallerOrgRole(orgId);
  if (role === "admin" || role === "super") return { ok: true };
  return { ok: false, error: "Action réservée aux administrateurs de l'organisation." };
}

/**
 * Client service_role (serveur uniquement) pour lire/écrire à travers toutes
 * les organisations en bypassant la RLS. À n'utiliser QU'APRÈS requireSuperAdmin().
 */
export function createAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) return null;
  return createServiceClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
