"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { cancelQueuedMessage } from "@/app/admin/contacts/actions";
import type { Message } from "@/lib/outreach/types";

const dtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const KIND_LABEL: Record<string, string> = {
  initial: "Premier mail", relance: "Relance", reponse: "Réponse", hors_admin: "Envoyé hors admin",
  entrant: "Message reçu", entrant_auto: "Réponse automatique du destinataire", rebond: "Rebond",
  plainte: "Plainte", lien: "Action par lien", formulaire: "Formulaire",
};
const SEND_LABEL: Record<string, string> = {
  a_valider: "Brouillon", planifie: "Dans la file", en_cours: "Envoi en cours", envoye: "Envoyé", echec: "Échec", annule: "Annulé",
};

/** One message of a thread. The quoted part of a received mail is hidden until asked for. */
export function MessageRow({ m }: { m: Message }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [full, setFull] = useState(false);

  const inbound = m.direction === "in";
  const hasQuote = inbound && !!m.body_reply && !!m.body_text && m.body_text.trim() !== m.body_reply.trim();
  const text = inbound ? (full ? m.body_text : m.body_reply ?? m.body_text) : m.body_text ?? m.draft_text;
  const when = m.sent_at ?? m.received_at ?? m.created_at;

  return (
    <li className={`rounded-xl border p-4 ${inbound ? "border-border bg-white" : "border-peach bg-peach-pale/50"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-warmgray">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          {inbound ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          {inbound ? "Reçu" : m.author === "auto" ? "Envoyé (automatique)" : "Envoyé par toi"}
          <span className="font-normal text-warmgray">· {KIND_LABEL[m.kind] ?? m.kind}</span>
        </span>
        <span className="flex items-center gap-2">
          {!inbound && m.send_status ? (
            <span className={`mc-badge ${m.send_status === "envoye" ? "mc-badge-green" : m.send_status === "echec" ? "mc-badge-red" : "mc-badge-gray"}`}>
              {SEND_LABEL[m.send_status] ?? m.send_status}
            </span>
          ) : null}
          <time dateTime={when}>{dtFmt.format(new Date(when))}</time>
        </span>
      </div>

      {m.subject ? <div className="mb-1 text-[12px] text-warmgray">Objet : {m.subject}</div> : null}
      <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-ink">{text || "(message vide)"}</pre>

      {hasQuote ? (
        <button type="button" className="mt-2 text-[12px] text-warmgray underline" onClick={() => setFull((v) => !v)}>
          {full ? "Masquer la citation" : "Voir le message complet"}
        </button>
      ) : null}

      {m.attachments?.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {m.attachments.map((a, i) => (
            <li key={i} className="mc-tag"><Paperclip className="size-3" /> {a.name ?? a.filename ?? "pièce jointe"}</li>
          ))}
        </ul>
      ) : null}

      {!inbound && m.send_status === "planifie" ? (
        <div className="mt-2 flex items-center gap-3 text-[12px] text-warmgray">
          {m.scheduled_for ? <span>Prévu le {dtFmt.format(new Date(m.scheduled_for))}</span> : null}
          <button
            type="button"
            className="mc-btn mc-btn-outline mc-btn-sm"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await cancelQueuedMessage(m.id);
              if (res.ok) { toast.success("Message annulé"); router.refresh(); } else toast.error(res.error ?? "Annulation impossible.");
            })}
          >
            Annuler l&apos;envoi
          </button>
        </div>
      ) : null}
      {!inbound && m.send_error ? <p className="mt-2 text-[12px] text-red-700">Erreur d&apos;envoi : {m.send_error}</p> : null}
    </li>
  );
}
