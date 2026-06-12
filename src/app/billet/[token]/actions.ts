"use server";

import { cancelTicketByToken, type CancelTicketResult } from "@/lib/events/register";

/** Annulation d'un billet par son porteur (page publique /billet/<token>). */
export async function cancelTicketAction(token: string): Promise<CancelTicketResult> {
  return cancelTicketByToken(token);
}
