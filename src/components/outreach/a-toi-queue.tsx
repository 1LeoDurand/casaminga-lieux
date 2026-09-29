import Link from "next/link";
import { NEEDS_LEO_LABELS, type ThreadListItem } from "@/lib/outreach/types";
import { EmptyLine, StageBadge, ThreadLink, ageLabel } from "./ui";

/**
 * File "à toi": threads flagged needs_leo, grouped by program then by reason,
 * oldest first, with the one-sentence AI summary when there is one.
 */
export function AToiQueue({ items, now }: { items: ThreadListItem[]; now: number }) {
  if (items.length === 0) return <EmptyLine>Rien n&apos;attend ta réponse.</EmptyLine>;

  const byProgram = new Map<string, ThreadListItem[]>();
  for (const t of items) {
    const list = byProgram.get(t.program_label) ?? [];
    list.push(t);
    byProgram.set(t.program_label, list);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...byProgram.entries()].map(([program, threads]) => {
        const byReason = new Map<string, ThreadListItem[]>();
        for (const t of threads) {
          const key = t.needs_leo_reason ?? "autre";
          const list = byReason.get(key) ?? [];
          list.push(t);
          byReason.set(key, list);
        }
        return (
          <div key={program}>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-warmgray">{program} · {threads.length}</h3>
            <div className="flex flex-col gap-3">
              {[...byReason.entries()].map(([reason, list]) => (
                <div key={reason} className="rounded-xl border border-border bg-white">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2">
                    <span className="mc-badge mc-badge-red">{NEEDS_LEO_LABELS[reason as keyof typeof NEEDS_LEO_LABELS] ?? reason}</span>
                    <span className="text-[11px] text-warmgray">{list.length} fil{list.length > 1 ? "s" : ""}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {list.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-[13px]">
                        <div className="min-w-0 flex-1">
                          <ThreadLink id={t.id}>{t.contact_name}</ThreadLink>
                          <span className="ml-2 text-warmgray">{t.email_subject}</span>
                          {t.ai_summary ? <p className="mt-0.5 text-[12px] text-warmgray">{t.ai_summary}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[11px] text-warmgray">
                          <StageBadge label={t.stage_label} role={t.stage_role} />
                          <span>depuis {ageLabel(t.needs_leo_since, now)}</span>
                          <Link className="mc-btn mc-btn-outline mc-btn-sm" href={`/admin/contacts/fils/${t.id}`}>Ouvrir</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
