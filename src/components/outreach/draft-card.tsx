"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2, Undo2 } from "lucide-react";
import { discardDraft, setThreadStatus, updateDraftText, validateDraft } from "@/app/admin/contacts/actions";

export interface DraftMessage {
  id: string;
  kind: string;
  text: string;
  send_status: string;
  scheduled_for: string | null;
}

const KIND_LABEL: Record<string, string> = { initial: "Premier mail", relance: "Relance (J+10 si pas de réponse)" };
const dtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** A draft of an outbound thread: edit the texts, validate, discard, or withdraw from the queue. */
export function DraftCard({ threadId, subject, isDraft, draftSlug, messages, isCustom }: {
  threadId: string;
  subject: string;
  /** true = stage a_valider; false = already queued (planifie). */
  isDraft: boolean;
  draftSlug: string;
  messages: DraftMessage[];
  isCustom: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(messages.map((m) => [m.id, m.text])));

  function done(res: { ok: boolean; error?: string }, okText: string) {
    if (res.ok) { toast.success(okText); router.refresh(); }
    else toast.error(res.error ?? "Action impossible.");
  }

  function save(m: DraftMessage) {
    start(async () => done(await updateDraftText(m.id, texts[m.id] ?? ""), "Texte enregistré"));
  }

  const dirty = (m: DraftMessage) => (texts[m.id] ?? "") !== m.text;
  const anyDirty = messages.some(dirty);

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{subject}</span>
        {isCustom ? <span className="mc-badge mc-badge-purple">Personnalisé</span> : null}
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id}>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase text-warmgray">
              <span>{KIND_LABEL[m.kind] ?? m.kind}</span>
              {m.send_status === "planifie" && m.scheduled_for ? <span>Prévu le {dtFmt.format(new Date(m.scheduled_for))}</span> : null}
            </div>
            {isDraft && m.send_status === "a_valider" ? (
              <>
                <textarea
                  className="mc-textarea"
                  rows={m.kind === "relance" ? 4 : 9}
                  value={texts[m.id] ?? ""}
                  onChange={(e) => setTexts((t) => ({ ...t, [m.id]: e.target.value }))}
                />
                {dirty(m) ? (
                  <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1.5" disabled={pending} onClick={() => save(m)}>
                    Enregistrer ce texte
                  </button>
                ) : null}
              </>
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg bg-cream p-3 text-[13px] text-ink">{m.text}</pre>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <button
              type="button"
              className="mc-btn mc-btn-lime mc-btn-sm"
              disabled={pending || anyDirty}
              title={anyDirty ? "Enregistre d'abord tes modifications" : undefined}
              onClick={() => start(async () => done(await validateDraft(threadId), "Brouillon validé, mis dans la file"))}
            >
              <Check className="size-3.5" /> Valider
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-outline mc-btn-sm"
              disabled={pending}
              onClick={() => start(async () => done(await discardDraft(threadId, "abandonne"), "Brouillon écarté"))}
            >
              <Trash2 className="size-3.5" /> Écarter
            </button>
          </>
        ) : (
          <button
            type="button"
            className="mc-btn mc-btn-outline mc-btn-sm"
            disabled={pending}
            onClick={() => start(async () => done(await setThreadStatus(threadId, draftSlug), "Retiré de la file"))}
          >
            <Undo2 className="size-3.5" /> Retirer de la file
          </button>
        )}
      </div>
    </div>
  );
}
