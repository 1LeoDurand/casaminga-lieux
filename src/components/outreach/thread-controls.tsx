"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { markHandled, sendReply, setThreadStatus, setThreadSubject } from "@/app/admin/contacts/actions";
import { CLOSED_REASON_LABELS, type ClosedReason } from "@/lib/outreach/types";
import { MANUAL_CLOSED_REASONS } from "@/lib/outreach/status";

export interface TargetOption { slug: string; label: string; closes: boolean }

/** Stage change (allowed transitions only), subject, and lifting the "à toi" flag. */
export function ThreadControls({ threadId, currentStatus, targets, needsLeo, subjects, currentSubjectId }: {
  threadId: string;
  currentStatus: string;
  targets: TargetOption[];
  needsLeo: boolean;
  subjects: { id: string; label: string }[];
  currentSubjectId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState<ClosedReason>("sans_suite");
  const chosen = targets.find((t) => t.slug === target);

  function after(res: { ok: boolean; error?: string }, okText: string) {
    if (res.ok) { toast.success(okText); router.refresh(); }
    else toast.error(res.error ?? "Action impossible.");
  }

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {needsLeo ? (
        <button type="button" className="mc-btn mc-btn-outline mc-btn-sm self-start" disabled={pending}
          onClick={() => start(async () => after(await markHandled(threadId), "Marqué comme traité"))}>
          <CheckCheck className="size-3.5" /> C&apos;est traité, lever « à toi »
        </button>
      ) : null}

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase text-warmgray">Changer d&apos;étape</div>
        {targets.length === 0 ? (
          <p className="text-warmgray">Aucune transition n&apos;est possible pour toi depuis cette étape.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select className="mc-input !w-auto" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Nouvelle étape">
              <option value="">Choisir…</option>
              {targets.filter((t) => t.slug !== currentStatus).map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
            </select>
            {chosen?.closes ? (
              <select className="mc-input !w-auto" value={reason} onChange={(e) => setReason(e.target.value as ClosedReason)} aria-label="Motif de clôture">
                {MANUAL_CLOSED_REASONS.map((r) => <option key={r} value={r}>{CLOSED_REASON_LABELS[r]}</option>)}
              </select>
            ) : null}
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !target}
              onClick={() => start(async () => {
                const res = await setThreadStatus(threadId, target, chosen?.closes ? reason : undefined);
                if (res.ok) setTarget("");
                after(res, "Étape changée");
              })}>
              Appliquer
            </button>
          </div>
        )}
      </div>

      {subjects.length > 0 ? (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase text-warmgray">Sujet du fil</div>
          <select className="mc-input !w-auto" value={currentSubjectId ?? ""} disabled={pending}
            onChange={(e) => e.target.value && start(async () => after(await setThreadSubject(threadId, e.target.value), "Sujet modifié"))}>
            {!currentSubjectId ? <option value="">Non classé</option> : null}
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}

/** Reply written by Leo: queued as approved, sent by the cron (nothing leaves from here). */
export function ReplyBox({ threadId, initial, canReply }: { threadId: string; initial: string; canReply: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(initial);
  const [knowledge, setKnowledge] = useState(false);

  if (!canReply) return <p className="text-[13px] text-warmgray">Le fil est clos, ou aucun message reçu n'attend de réponse. Rouvre le fil pour répondre.</p>;

  return (
    <div className="flex flex-col gap-2">
      <textarea className="mc-textarea" rows={9} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Ta réponse…" aria-label="Réponse" />
      <label className="flex items-center gap-2 text-[12px] text-warmgray">
        <input type="checkbox" checked={knowledge} onChange={(e) => setKnowledge(e.target.checked)} />
        Ajouter aux réponses approuvées (sert de modèle à l&apos;IA)
      </label>
      <div className="flex items-center gap-3">
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !text.trim()}
          onClick={() => start(async () => {
            const res = await sendReply(threadId, text, knowledge);
            if (res.ok) { toast.success("Réponse mise dans la file d'envoi"); setText(""); router.refresh(); }
            else toast.error(res.error ?? "Envoi impossible.");
          })}>
          Envoyer
        </button>
        <span className="text-[11px] text-warmgray">La réponse part au prochain passage du cron d&apos;envoi.</span>
      </div>
    </div>
  );
}
