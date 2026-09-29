/**
 * Action `correction` du lien signé : le lieu signale une erreur dans l'article.
 *
 * Effets (spec 8.2) : un message entrant `kind = 'lien'` (texte tel que saisi,
 * jamais lu par l'IA : l'index de classement ne retient que 'entrant' et
 * 'formulaire'), le fil passe à l'étape de rôle `conversation` quand la
 * transition existe, la relance est annulée, le fil est marqué « à toi » avec
 * le motif `lien_correction`, un événement est écrit. Aucune décision
 * automatique : modifier un article est une zone rouge, Léo tranche.
 *
 * Client de service injecté : le fichier ne lit aucun secret.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkStage, LinkThread } from "./link-types";

export const MAX_CORRECTION_CHARS = 4000;
export const MIN_CORRECTION_CHARS = 5;

export type CorrectionTextResult =
  | { ok: true; text: string }
  | { ok: false; error: "empty" | "long" };

/** Normalise les fins de ligne, retire les caractères de contrôle (sauf saut de ligne et tabulation), refuse au-delà de la limite. */
export function cleanCorrectionText(raw: unknown): CorrectionTextResult {
  if (typeof raw !== "string") return { ok: false, error: "empty" };
  const text = raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (text.length < MIN_CORRECTION_CHARS) return { ok: false, error: "empty" };
  if (text.length > MAX_CORRECTION_CHARS) return { ok: false, error: "long" };
  return { ok: true, text };
}

export async function recordCorrection(
  admin: SupabaseClient,
  input: {
    thread: Pick<LinkThread, "id" | "program_id" | "contact_id" | "status" | "first_inbound_at">;
    stages: LinkStage[];
    fromEmail: string | null;
    text: string;
    now?: Date;
  }
): Promise<{ ok: boolean; messageId?: string }> {
  const { thread } = input;
  const nowIso = (input.now ?? new Date()).toISOString();

  const { data: msg, error } = await admin
    .from("outreach_messages")
    .insert({
      thread_id: thread.id,
      direction: "in",
      kind: "lien",
      from_email: input.fromEmail,
      subject: "Correction signalée depuis le lien",
      body_text: input.text,
      body_reply: input.text,
      received_at: nowIso,
      match_method: "lien",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !msg) return { ok: false };

  const role = input.stages.find((s) => s.slug === thread.status)?.role;
  const conversation = input.stages.find((s) => s.role === "conversation")?.slug;
  const canAdvance = conversation && (role === "attente" || role === "relance");

  const patch: Record<string, unknown> = {
    correction_requested_at: nowIso,
    last_inbound_at: nowIso,
    needs_leo: true,
    needs_leo_reason: "lien_correction",
    needs_leo_since: nowIso,
  };
  if (!thread.first_inbound_at) patch.first_inbound_at = nowIso;
  if (canAdvance) patch.status = conversation;
  let { error: threadError } = await admin.from("outreach_threads").update(patch).eq("id", thread.id);
  if (threadError && canAdvance) {
    delete patch.status; // transition refusée : on garde le reste (le message et le drapeau)
    ({ error: threadError } = await admin.from("outreach_threads").update(patch).eq("id", thread.id));
  }

  await admin
    .from("outreach_messages")
    .update({ send_status: "annule" })
    .eq("thread_id", thread.id)
    .eq("direction", "out")
    .eq("kind", "relance")
    .in("send_status", ["a_valider", "planifie"]);

  try {
    await admin.from("outreach_events").insert({
      program_id: thread.program_id,
      thread_id: thread.id,
      contact_id: thread.contact_id,
      message_id: msg.id,
      actor: "lien",
      type: "link.correction",
      // Ni le texte, ni l'adresse : seulement sa taille.
      data: { chars: input.text.length, advanced: Boolean(canAdvance) },
    });
  } catch {
    // journal facultatif
  }

  return { ok: !threadError, messageId: msg.id };
}
