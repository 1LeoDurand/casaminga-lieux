import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getThreadDetail } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import { allowedTargets, stageBySlug } from "@/lib/outreach/status";
import { CLOSED_REASON_LABELS } from "@/lib/outreach/types";
import { AiPanel } from "@/components/outreach/ai-panel";
import { MessageRow } from "@/components/outreach/message-row";
import { ReplyBox, ThreadControls } from "@/components/outreach/thread-controls";
import { EmptyLine, ReasonBadge, Section, StageBadge, fmtDateTime } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ThreadPage({ params }: PageProps) {
  await requireSuperAdmin();
  const { id } = await params;
  const d = await getThreadDetail(id);
  if (!d) notFound();
  const { thread, program, contact, article, messages, events, subjects, redZones } = d;
  const programs = await getProgramConfigs();

  const stage = stageBySlug(program, thread.status);
  const targets = allowedTargets(program, thread.status, "leo").map((s) => ({ slug: s.slug, label: s.label, closes: s.role === "clos" }));
  const lastInbound = [...messages].reverse().find((m) => m.direction === "in") ?? null;
  const lastHuman = [...messages].reverse().find((m) => m.direction === "in" && (m.kind === "entrant" || m.kind === "formulaire")) ?? lastInbound;
  const role = stage?.role ?? null;
  const canReply = role !== "clos" && role !== "a_valider" && role !== "planifie" && messages.some((m) => m.direction === "in");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/admin/contacts/lieux/${contact.id}`} className="inline-flex items-center gap-1 text-[12px] text-warmgray hover:text-ink">
          <ArrowLeft className="size-3.5" /> {contact.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-xl font-extrabold text-ink">{thread.email_subject}</h2>
          <StageBadge label={stage?.label ?? thread.status} role={role} />
          {thread.closed_reason ? <span className="text-[12px] text-warmgray">{CLOSED_REASON_LABELS[thread.closed_reason]}</span> : null}
          {thread.needs_leo ? <ReasonBadge reason={thread.needs_leo_reason} /> : null}
        </div>
        <p className="mt-1 text-[13px] text-warmgray">
          {program.label} · {contact.name}
          {article ? <> · <a className="inline-flex items-center gap-0.5 underline" href={article.url} target="_blank" rel="noopener noreferrer">{article.title}<ExternalLink className="size-3" /></a></> : null}
          {thread.external_type === "claim" ? <> · <Link className="underline" href="/admin/revendications">revendication</Link></> : null}
        </p>
        {thread.needs_leo_since ? <p className="text-[12px] text-warmgray">À toi depuis le {fmtDateTime(thread.needs_leo_since)}</p> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Messages">
            {messages.length === 0 ? (
              <EmptyLine>Aucun message dans ce fil.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m) => <MessageRow key={m.id} m={m} />)}
              </ul>
            )}
          </Section>

          <Section title="Répondre" hint={lastHuman?.ai_draft ? "Brouillon préparé par l'IA : relis-le et corrige avant d'envoyer." : undefined}>
            {role === "a_valider" || role === "planifie" ? (
              <p className="text-[13px] text-warmgray">
                Ce fil est encore un brouillon sortant : modifie-le et valide-le depuis la{" "}
                <Link className="underline" href={`/admin/contacts/lieux/${contact.id}`}>fiche du lieu</Link>.
              </p>
            ) : (
              <ReplyBox key={lastHuman?.id ?? "none"} threadId={thread.id} initial={lastHuman?.ai_draft ?? ""} canReply={canReply} />
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Lecture par l'IA">
            <AiPanel message={lastInbound} thread={thread} subjects={subjects} redZones={redZones} contextVersion={d.contextVersion} programs={programs} />
          </Section>

          <Section title="Actions">
            <ThreadControls
              threadId={thread.id}
              currentStatus={thread.status}
              targets={targets}
              needsLeo={thread.needs_leo}
              subjects={subjects.map((s) => ({ id: s.id, label: s.label }))}
              currentSubjectId={thread.current_subject_id}
            />
          </Section>

          <Section title="Historique">
            {events.length === 0 ? (
              <EmptyLine>Aucun événement.</EmptyLine>
            ) : (
              <ul className="divide-y divide-border text-[12px]">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span><span className="font-mono">{e.type}</span> <span className="text-warmgray">· {e.actor}</span></span>
                    <span className="text-warmgray">{fmtDateTime(e.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
