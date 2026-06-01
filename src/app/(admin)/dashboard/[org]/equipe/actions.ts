"use server";
import { revalidatePath } from "next/cache";
import { updateTeamMemberRole, removeTeamMember } from "@/lib/data";
import type { OrgRole } from "@/lib/types";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/equipe`);
}

export async function updateMemberRoleAction(
  orgSlug: string, orgId: string, userId: string, role: OrgRole, zones: string[]
) {
  const ok = await updateTeamMemberRole(orgId, userId, role, zones);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function removeMemberAction(orgSlug: string, orgId: string, userId: string) {
  const ok = await removeTeamMember(orgId, userId);
  if (ok) refresh(orgSlug);
  return { ok };
}
