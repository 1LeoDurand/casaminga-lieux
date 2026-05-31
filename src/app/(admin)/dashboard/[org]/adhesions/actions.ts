"use server";
import { revalidatePath } from "next/cache";
import {
  createMembershipCampaign, updateMembershipCampaign, deleteMembershipCampaign, type MembershipCampaignInput,
  createMembershipTier, updateMembershipTier, deleteMembershipTier, type MembershipTierInput,
  updateMembershipApplication, type MembershipApplicationInput,
} from "@/lib/data";

function refresh(s: string) { revalidatePath(`/dashboard/${s}/adhesions`); }

export async function createCampaignAction(orgSlug: string, input: MembershipCampaignInput): Promise<{ ok: boolean }> {
  const ok = await createMembershipCampaign(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateCampaignAction(orgSlug: string, id: string, patch: Partial<MembershipCampaignInput>): Promise<{ ok: boolean }> {
  const ok = await updateMembershipCampaign(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteCampaignAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteMembershipCampaign(id); if (ok) refresh(orgSlug); return { ok };
}
export async function createTierAction(orgSlug: string, input: MembershipTierInput): Promise<{ ok: boolean }> {
  const ok = await createMembershipTier(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateTierAction(orgSlug: string, id: string, patch: Partial<MembershipTierInput>): Promise<{ ok: boolean }> {
  const ok = await updateMembershipTier(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteTierAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteMembershipTier(id); if (ok) refresh(orgSlug); return { ok };
}
export async function updateApplicationAction(orgSlug: string, id: string, patch: Partial<MembershipApplicationInput>): Promise<{ ok: boolean }> {
  const ok = await updateMembershipApplication(id, patch); if (ok) refresh(orgSlug); return { ok };
}
