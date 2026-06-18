"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateTeamMemberRole, removeTeamMember } from "@/lib/data";
import { humanError } from "@/lib/errors";
import { assertOrgAdmin } from "@/lib/admin/guard";
import { roleLabel } from "@/lib/roles";
import type { OrgRole } from "@/lib/roles";

type AR = { ok: boolean; error?: string };

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/equipe`);
}

// ── Membres existants ─────────────────────────────────────────

export async function updateMemberRoleAction(
  orgSlug: string, orgId: string, userId: string, role: OrgRole, zones: string[]
): Promise<AR> {
  const guard = await assertOrgAdmin(orgId);
  if (!guard.ok) return guard;
  const ok = await updateTeamMemberRole(orgId, userId, role, zones);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function setMemberStatusAction(
  orgSlug: string, orgId: string, userId: string, status: "actif" | "suspendu"
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ status })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: humanError(error) };
  refresh(orgSlug);
  return { ok: true };
}

export async function removeMemberAction(orgSlug: string, orgId: string, userId: string): Promise<AR> {
  const ok = await removeTeamMember(orgId, userId);
  if (ok) refresh(orgSlug);
  return { ok };
}

// ── Invitations ──────────────────────────────────────────────

export interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  token: string;
}

export async function listInvitationsAction(orgId: string): Promise<Invitation[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, role, created_at, expires_at, used_at, token")
    .eq("organization_id", orgId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []) as Invitation[];
}

export async function inviteMemberAction(
  orgSlug: string, orgId: string, email: string, role: OrgRole
): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const guard = await assertOrgAdmin(orgId);
  if (!guard.ok) return guard;
  const supabase = await createClient();

  // Générer un token hex 32 octets via Postgres
  const { data: tokenData, error: tokenErr } = await supabase
    .rpc("generate_invitation_token");

  let token: string;
  if (tokenErr || !tokenData) {
    // Fallback : générer côté JS
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    token = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    token = tokenData as string;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("invitations").insert({
    organization_id: orgId,
    email: email.toLowerCase().trim(),
    role,
    token,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: humanError(error) };

  // Envoyer l'email d'invitation
  try {
    const { sendMail } = await import("@/lib/mail");
    const { getOrganizationBySlug } = await import("@/lib/data");
    const { tplInvitationCompte } = await import("@/lib/mail-templates");
    const org = await getOrganizationBySlug(orgSlug);
    const orgName = org?.name ?? "l'espace";
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com"}/rejoindre/${token}`;
    await sendMail({
      to: email,
      subject: `Invitation à rejoindre ${orgName} sur Casa Minga`,
      html: tplInvitationCompte({ orgName, inviteUrl, roleLabelStr: roleLabel(role) }),
      category: "invitation",
      organizationId: orgId,
    });
  } catch (e) {
    console.error("inviteMemberAction: email non envoyé", e);
    // On ne bloque pas — l'invitation est créée même sans email
  }

  refresh(orgSlug);
  return { ok: true };
}

export async function revokeInvitationAction(orgSlug: string, id: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  refresh(orgSlug);
  return { ok: true };
}

export async function resendInvitationAction(orgSlug: string, orgId: string, id: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  // Prolonger l'expiration de 7 jours supplémentaires
  const supabase = await createClient();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inv, error } = await supabase
    .from("invitations")
    .update({ expires_at: newExpiry })
    .eq("id", id)
    .select("email, role, token")
    .single();
  if (error || !inv) return { ok: false, error: error ? humanError(error) : "Invitation introuvable." };

  // Renvoyer l'email
  await inviteMemberAction(orgSlug, orgId, inv.email, inv.role as OrgRole);
  refresh(orgSlug);
  return { ok: true };
}
