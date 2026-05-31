"use server";

import { revalidatePath } from "next/cache";
import {
  createReservation,
  deleteReservation,
  updateReservation,
  type ReservationInput,
  type ReservationWriteResult,
} from "@/lib/data";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/reservations`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createReservationAction(
  orgSlug: string,
  input: ReservationInput
): Promise<ReservationWriteResult> {
  const res = await createReservation(input);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function updateReservationAction(
  orgSlug: string,
  id: string,
  patch: Partial<ReservationInput>
): Promise<ReservationWriteResult> {
  const res = await updateReservation(id, patch);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function deleteReservationAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deleteReservation(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
