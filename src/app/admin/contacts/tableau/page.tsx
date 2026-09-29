import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getBoard, mondayOf, recentWeeks } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import { ContactsBoard } from "@/components/outreach/contacts-board";
import { EmptyLine, ProgramSelector, ThreadLink, StageBadge, ReasonBadge, ageLabel, fmtDate, withProgram } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ programme?: string; article?: string; semaine?: string; sujet?: string }> };

export default async function ContactsBoardPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const programs = await getProgramConfigs();
  const program = programs.find((p) => p.slug === sp.programme) ?? null;

  const header = <ProgramSelector programs={programs} current={program?.slug ?? null} basePath="/admin/contacts/tableau" />;

  // "Tous": the board needs one program, so list the active threads instead.
  if (!program) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <EmptyLine>
          Le tableau montre les étapes d&apos;un seul programme. Choisis-en un ci-dessus, ou ouvre la{" "}
          <Link className="underline" href="/admin/contacts/lieux">liste des lieux</Link>{" "}
          pour voir tous les fils.
        </EmptyLine>
      </div>
    );
  }

  const board = await getBoard(program, { article: sp.article, semaine: sp.semaine, sujet: sp.sujet });
  const thisWeek = mondayOf(new Date());
  const weeks = recentWeeks(12);
  const now = Date.now();
  const base = "/admin/contacts/tableau";
  const keep = { article: sp.article, sujet: sp.sujet };

  return (
    <div className="flex flex-col gap-5">
      {header}

      <form method="get" action={base} className="mc-card flex flex-wrap items-end gap-3 p-[14px]">
        <input type="hidden" name="programme" value={program.slug} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Semaine d&apos;arrivée</span>
          <select name="semaine" defaultValue={sp.semaine ?? ""} className="mc-input">
            <option value="">Toutes</option>
            {weeks.map((w) => <option key={w} value={w}>{w === thisWeek ? "Cette semaine" : `Semaine du ${fmtDate(w + "T12:00:00Z")}`}</option>)}
          </select>
        </label>
        {program.uses_articles ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase text-warmgray">Article</span>
            <select name="article" defaultValue={sp.article ?? ""} className="mc-input">
              <option value="">Tous</option>
              {board.articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Sujet</span>
          <select name="sujet" defaultValue={sp.sujet ?? ""} className="mc-input">
            <option value="">Tous</option>
            {board.subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button type="submit" className="mc-btn mc-btn-lime mc-btn-sm">Filtrer</button>
        <Link className="mc-btn mc-btn-outline mc-btn-sm" href={withProgram(base, program.slug, { ...keep, semaine: thisWeek })}>Cette semaine</Link>
        <Link className="mc-btn mc-btn-outline mc-btn-sm" href={withProgram(base, program.slug)}>Tout afficher</Link>
      </form>

      <p className="text-[11px] text-warmgray">
        Glisse une carte pour changer son étape : seules les transitions que tu es autorisé à faire sont acceptées, la base refuse les autres.
        Les fils clos n&apos;apparaissent pas. {board.truncated ? "Seuls les 200 fils les plus récents sont affichés : affine avec les filtres." : ""}
      </p>

      <ContactsBoard program={program} threads={board.threads} />

      {/* Same threads as a list: readable on a phone, where columns are cramped. */}
      {board.threads.length > 0 ? (
        <details className="mc-card p-[14px]">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink">Voir en liste ({board.threads.length})</summary>
          <ul className="mt-3 divide-y divide-border text-[13px]">
            {board.threads.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0"><ThreadLink id={t.id}>{t.contact_name}</ThreadLink> <span className="text-warmgray">{t.email_subject}</span></span>
                <span className="flex items-center gap-2">
                  <ReasonBadge reason={t.needs_leo_reason} />
                  <StageBadge label={t.stage_label} role={t.stage_role} />
                  <span className="text-[11px] text-warmgray">{ageLabel(t.status_changed_at, now)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
