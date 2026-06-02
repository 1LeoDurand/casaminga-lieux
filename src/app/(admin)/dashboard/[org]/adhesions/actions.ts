"use server";
import { revalidatePath } from "next/cache";
import {
  createMembershipCampaign, updateMembershipCampaign, deleteMembershipCampaign, type MembershipCampaignInput,
  createMembershipTier, updateMembershipTier, deleteMembershipTier, type MembershipTierInput,
  updateMembershipApplication, getMembershipApplicationById, type MembershipApplicationInput,
} from "@/lib/data";
import { sendMail } from "@/lib/mail";
import { tplAdhesionValidee } from "@/lib/mail-templates";

function refresh(s: string) { revalidatePath(`/dashboard/${s}/adhesions`); }

export async function createCampaignAction(orgSlug: string, input: MembershipCampaignInput): Promise<{ ok: boolean; id?: string }> {
  const id = await createMembershipCampaign(input);
  if (id) { refresh(orgSlug); return { ok: true, id }; }
  return { ok: false };
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

export async function updateApplicationAction(
  orgSlug: string,
  id: string,
  patch: Partial<MembershipApplicationInput>,
  orgName?: string
): Promise<{ ok: boolean }> {
  // Récupérer les données avant la mise à jour pour l'email
  const application = patch.status === "confirmee" ? await getMembershipApplicationById(id) : null;

  const ok = await updateMembershipApplication(id, patch);
  if (ok) {
    refresh(orgSlug);

    // Email de validation d'adhésion
    if (patch.status === "confirmee" && application) {
      void sendMail({
        to: application.email,
        subject: `✓ Votre adhésion est validée — ${orgName ?? orgSlug}`,
        html: tplAdhesionValidee({
          orgName: orgName ?? orgSlug,
          firstName: application.first_name,
          lastName: application.last_name,
          tierLabel: "Adhésion confirmée",
          amount: application.amount_paid,
          membershipStart: application.membership_start,
          membershipEnd: application.membership_end,
        }),
      });
    }
  }
  return { ok };
}
