"use server";
import { revalidatePath } from "next/cache";
import {
  createMeeting, deleteMeeting, updateMeeting, type MeetingInput,
  createMandate, deleteMandate, updateMandate, type MandateInput,
} from "@/lib/data";
function refresh(s: string) { revalidatePath(`/dashboard/${s}/gouvernance`); }

export async function createMeetingAction(orgSlug: string, input: MeetingInput): Promise<{ ok: boolean }> {
  const ok = await createMeeting(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateMeetingAction(orgSlug: string, id: string, patch: Partial<MeetingInput>): Promise<{ ok: boolean }> {
  const ok = await updateMeeting(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteMeetingAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteMeeting(id); if (ok) refresh(orgSlug); return { ok };
}
export async function createMandateAction(orgSlug: string, input: MandateInput): Promise<{ ok: boolean }> {
  const ok = await createMandate(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateMandateAction(orgSlug: string, id: string, patch: Partial<MandateInput>): Promise<{ ok: boolean }> {
  const ok = await updateMandate(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteMandateAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteMandate(id); if (ok) refresh(orgSlug); return { ok };
}
