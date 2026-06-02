"use server";

import { revalidatePath } from "next/cache";
import {
  createReservation,
  deleteReservation,
  updateReservation,
  type ReservationInput,
  type ReservationWriteResult,
} from "@/lib/data";
import { sendMail } from "@/lib/mail";
import {
  tplReservationConfirmee,
  tplReservationApprouvee,
  tplReservationAnnulee,
} from "@/lib/mail-templates";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/reservations`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

/** Métadonnées email passées séparément (ne font pas partie de ReservationInput). */
export interface ReservationMailMeta {
  orgName?: string;
  contactEmail?: string;
  contactName?: string;
  spaceName?: string;
}

export async function createReservationAction(
  orgSlug: string,
  input: ReservationInput,
  mail?: ReservationMailMeta
): Promise<ReservationWriteResult> {
  const res = await createReservation(input);
  if (res.ok && mail?.contactEmail) {
    refresh(orgSlug);
    void sendMail({
      to: mail.contactEmail,
      subject: `✓ Réservation enregistrée — ${mail.orgName ?? orgSlug}`,
      html: tplReservationConfirmee({
        orgName: mail.orgName ?? orgSlug,
        contactName: mail.contactName ?? "Madame/Monsieur",
        spaceName: mail.spaceName ?? "Espace",
        startAt: input.start_at,
        endAt: input.end_at,
        purpose: input.title ?? undefined,
      }),
    });
  } else if (res.ok) {
    refresh(orgSlug);
  }
  return res;
}

export async function updateReservationAction(
  orgSlug: string,
  id: string,
  patch: Partial<ReservationInput>,
  mail?: ReservationMailMeta & { startAt?: string; endAt?: string }
): Promise<ReservationWriteResult> {
  const res = await updateReservation(id, patch);
  if (res.ok) {
    refresh(orgSlug);

    if (patch.status === "confirmee" && mail?.contactEmail) {
      void sendMail({
        to: mail.contactEmail,
        subject: `✓ Réservation confirmée — ${mail.orgName ?? orgSlug}`,
        html: tplReservationApprouvee({
          orgName: mail.orgName ?? orgSlug,
          contactName: mail.contactName ?? "Madame/Monsieur",
          spaceName: mail.spaceName ?? "Espace",
          startAt: mail.startAt ?? "",
          endAt: mail.endAt ?? "",
        }),
      });
    }

    if (patch.status === "annulee" && mail?.contactEmail) {
      void sendMail({
        to: mail.contactEmail,
        subject: `Réservation annulée — ${mail.orgName ?? orgSlug}`,
        html: tplReservationAnnulee({
          orgName: mail.orgName ?? orgSlug,
          contactName: mail.contactName ?? "Madame/Monsieur",
          spaceName: mail.spaceName ?? "Espace",
          startAt: mail.startAt ?? "",
        }),
      });
    }
  }
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
