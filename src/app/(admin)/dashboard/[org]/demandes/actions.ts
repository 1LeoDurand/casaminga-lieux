"use server";

import { revalidatePath } from "next/cache";
import { updateRequestStatus, getRequestById } from "@/lib/data";
import type { RequestStatus } from "@/lib/types";
import { sendMail } from "@/lib/mail";
import { tplDemandeStatut } from "@/lib/mail-templates";

/** Change le statut d'une demande puis rafraîchit la page Demandes. */
export async function setRequestStatus(
  orgSlug: string,
  id: string,
  status: RequestStatus
): Promise<{ ok: boolean }> {
  // Récupérer la demande avant mise à jour pour avoir email + nom
  const req = await getRequestById(id);
  const ok = await updateRequestStatus(id, status);

  if (ok) {
    revalidatePath(`/dashboard/${orgSlug}/demandes`);
    revalidatePath(`/dashboard/${orgSlug}`);

    // Email de mise à jour au demandeur (sauf statuts internes)
    if (req?.email && ["validee", "refusee", "a_etudier"].includes(status)) {
      void sendMail({
        to: req.email,
        subject: `Mise à jour de votre demande — ${req.name ?? ""}`,
        html: tplDemandeStatut({
          orgName: orgSlug, // sera remplacé si on a org.name
          personName: req.name ?? "Madame/Monsieur",
          status,
        }),
      });
    }
  }
  return { ok };
}
