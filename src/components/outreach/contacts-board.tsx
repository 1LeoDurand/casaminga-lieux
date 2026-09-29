"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, Tag } from "lucide-react";
import { toast } from "sonner";
import { TaskBoard, type BoardColumn } from "@/components/mc/task-board";
import { setThreadStatus } from "@/app/admin/contacts/actions";
import { boardStages } from "@/lib/outreach/status";
import { NEEDS_LEO_LABELS, type ProgramConfig, type StageRole, type ThreadListItem } from "@/lib/outreach/types";

const ROLE_DOT: Record<StageRole, string> = {
  a_valider: "#e8a33d",
  planifie: "#3d8be8",
  attente: "#9a938f",
  relance: "#8a7f78",
  nouveau: "#e8714d",
  conversation: "#7d5fc4",
  resolu: "#3fa564",
  succes: "#2d8a4e",
  clos: "#b0a8a4",
};

const EMPTY_HINT: Partial<Record<StageRole, string>> = {
  a_valider: "Aucun brouillon à valider.",
  planifie: "Rien dans la file d'envoi.",
  attente: "Personne n'attend de réponse.",
  nouveau: "Aucun nouveau fil.",
  conversation: "Aucun échange en cours.",
};

const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });

function Card({ t }: { t: ThreadListItem }) {
  return (
    <div className="mc-resa-card">
      <div className="flex items-start justify-between gap-2">
        <span className="mc-resa-title">{t.contact_name}</span>
        {t.needs_leo ? (
          <span className="mc-badge mc-badge-red" title={t.needs_leo_reason ? NEEDS_LEO_LABELS[t.needs_leo_reason] : undefined}>À toi</span>
        ) : null}
      </div>
      <div className="text-[12px] text-warmgray line-clamp-2">{t.email_subject}</div>
      <div className="mc-resa-line">
        {t.subject_label ? <span className="mc-tag inline-flex items-center gap-1"><Tag className="size-3" />{t.subject_label}</span> : null}
        {t.article_title ? <span className="inline-flex items-center gap-1"><FileText className="size-3.5" /><span className="max-w-[140px] truncate">{t.article_title}</span></span> : null}
      </div>
      <div className="mc-resa-line"><Clock className="size-3.5" /> {dayFmt.format(new Date(t.status_changed_at))}</div>
    </div>
  );
}

export function ContactsBoard({ program, threads }: { program: ProgramConfig; threads: ThreadListItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, applyMove] = useOptimistic(
    threads,
    (state: ThreadListItem[], m: { id: string; status: string }) => state.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );

  const columns: BoardColumn[] = useMemo(
    () => boardStages(program).map((s) => ({ id: s.slug, label: s.label, dot: ROLE_DOT[s.role], empty: EMPTY_HINT[s.role] ?? "Aucun fil." })),
    [program],
  );

  function move(id: string, to: string) {
    start(async () => {
      applyMove({ id, status: to });
      // The server decides: a forbidden move comes back as an error and the card returns.
      const res = await setThreadStatus(id, to);
      if (res.ok) {
        toast.success("Fil déplacé");
        router.refresh();
      } else {
        toast.error(res.error ?? "Déplacement impossible.");
      }
    });
  }

  return (
    <TaskBoard
      columns={columns}
      items={view}
      getId={(t) => t.id}
      getColumnId={(t) => t.status}
      onMove={move}
      onCardClick={(id) => router.push(`/admin/contacts/fils/${id}`)}
      disabled={pending}
      renderCard={(t) => <Card t={t} />}
    />
  );
}
