"use server";
import { revalidatePath } from "next/cache";
import {
  createMeeting, deleteMeeting, updateMeeting, type MeetingInput,
  createMandate, deleteMandate, updateMandate, type MandateInput,
  createAssemblyProxy, deleteAssemblyProxy, upsertAttendance,
  createMeetingResolution, updateMeetingResolution, deleteMeetingResolution,
  type MeetingResolutionInput,
  getMeetingsForOrg, getPersonsForOrg,
} from "@/lib/data";
import { sendMail } from "@/lib/mail";
import { tplConvocation } from "@/lib/mail-templates";

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

// ── Résolutions ─────────────────────────────────────────────────────────────
export async function createResolutionAction(
  orgSlug: string, input: MeetingResolutionInput,
): Promise<{ ok: boolean }> {
  const ok = await createMeetingResolution(input);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function updateResolutionAction(
  orgSlug: string, id: string, patch: Partial<MeetingResolutionInput>,
): Promise<{ ok: boolean }> {
  const ok = await updateMeetingResolution(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deleteResolutionAction(
  orgSlug: string, id: string,
): Promise<{ ok: boolean }> {
  const ok = await deleteMeetingResolution(id);
  if (ok) refresh(orgSlug);
  return { ok };
}

// ── Convocation email ────────────────────────────────────────────────────────
export async function sendConvocationAction(
  orgSlug: string,
  orgId: string,
  meetingId: string,
  orgName: string,
): Promise<{ ok: boolean; sent: number; skipped: number }> {
  const [meetings, persons] = await Promise.all([
    getMeetingsForOrg(orgId),
    getPersonsForOrg(orgId),
  ]);

  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return { ok: false, sent: 0, skipped: 0 };

  const MEETING_TYPE_FR: Record<string, string> = {
    ag: "Assemblée Générale", ca: "Conseil d'Administration",
    bureau: "Réunion de Bureau", autre: "Réunion",
  };
  const meetingTypeLabel = MEETING_TYPE_FR[meeting.type] ?? "Réunion";

  const activeMembers = persons.filter((p) => p.status === "actif" && p.email);
  let sent = 0;
  let skipped = 0;

  for (const person of activeMembers) {
    if (!person.email) { skipped++; continue; }
    const firstName = person.name.split(" ")[0] ?? person.name;
    const ok = await sendMail({
      to: person.email,
      subject: `Convocation — ${meetingTypeLabel} · ${orgName}`,
      html: tplConvocation({
        orgName,
        meetingTitle: meeting.title,
        meetingDate: meeting.date,
        meetingType: meetingTypeLabel,
        agenda: meeting.agenda,
        firstName,
      }),
      category: "convocation",
      organizationId: orgId,
    });
    if (ok) sent++; else skipped++;
  }

  return { ok: sent > 0 || activeMembers.length === 0, sent, skipped };
}
