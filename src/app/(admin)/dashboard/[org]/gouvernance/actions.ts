"use server";
import { revalidatePath } from "next/cache";
import {
  createMeeting, deleteMeeting, updateMeeting, type MeetingInput,
  createMandate, deleteMandate, updateMandate, type MandateInput,
  createAssemblyProxy, deleteAssemblyProxy, upsertAttendance,
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

// ── AG : Pouvoirs ───────────────────────────────────────────────────────────
export async function createProxyAction(
  orgSlug: string, orgId: string, meetingId: string,
  giverPersonId: string, holderPersonId: string | null,
) {
  const res = await createAssemblyProxy(orgId, meetingId, giverPersonId, holderPersonId);
  if (res.ok) refresh(orgSlug);
  return res;
}
export async function deleteProxyAction(orgSlug: string, proxyId: string) {
  const ok = await deleteAssemblyProxy(proxyId);
  if (ok) refresh(orgSlug);
  return { ok };
}

// ── AG : Émargement ─────────────────────────────────────────────────────────
export async function upsertAttendanceAction(
  orgSlug: string, orgId: string, meetingId: string, personId: string, present: boolean,
) {
  const ok = await upsertAttendance(orgId, meetingId, personId, present);
  if (ok) refresh(orgSlug);
  return { ok };
}
