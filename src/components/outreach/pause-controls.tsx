"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import { setMailboxPause, setProgramPause } from "@/app/admin/contacts/actions";

/** Pause / resume of a mailbox or a program, with a reason (required to pause). */
export function PauseControls({ kind, id, paused, label }: {
  kind: "programme" | "boite";
  id: string;
  paused: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  function run(nextPaused: boolean, why?: string) {
    start(async () => {
      const res = kind === "programme" ? await setProgramPause(id, nextPaused, why) : await setMailboxPause(id, nextPaused, why);
      if (res.ok) {
        toast.success(nextPaused ? `${label} mis en pause` : `${label} relancé`);
        setAsking(false);
        setReason("");
        router.refresh();
      } else toast.error(res.error ?? "Action impossible.");
    });
  }

  if (paused) {
    return (
      <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending} onClick={() => run(false)}>
        <Play className="size-3.5" /> Reprendre
      </button>
    );
  }
  if (!asking) {
    return (
      <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setAsking(true)}>
        <Pause className="size-3.5" /> Mettre en pause
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        className="mc-input !w-56 !py-1.5"
        placeholder="Raison de la pause"
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !reason.trim()} onClick={() => run(true, reason)}>
        Confirmer
      </button>
      <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setAsking(false)}>Annuler</button>
    </span>
  );
}
