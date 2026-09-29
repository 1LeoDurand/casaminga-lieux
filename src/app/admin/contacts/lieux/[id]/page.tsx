import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getContactDetail } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import { stageByRole } from "@/lib/outreach/status";
import { ADDRESS_SOURCE_LABELS, CLOSED_REASON_LABELS } from "@/lib/outreach/types";
import { AToiQueue } from "@/components/outreach/a-toi-queue";
import { DraftCard, type DraftMessage } from "@/components/outreach/draft-card";
import { EmptyLine, ReasonBadge, Section, StageBadge, ThreadLink, fmtDate, fmtDateTime } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ContactPage({ params }: PageProps) {
  await requireSuperAdmin();
  const { id } = await params;
  const detail = await getContactDetail(id);
  if (!detail) notFound();
  const { contact, addresses, threads, drafts, grants, events } = detail;
  const programs = await getProgramConfigs();
  const now = Date.now();

  const needsLeo = threads.filter((t) => t.needs_leo);
  // Threads with a draft still to validate (or queued): one card each.
  const draftThreads = threads.filter((t) => t.stage_role === "a_valider" || t.stage_role === "planifie");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/contacts/lieux" className="inline-flex items-center gap-1 text-[12px] text-warmgray hover:text-ink">
          <ArrowLeft className="size-3.5" /> Tous les lieux
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-xl font-extrabold text-ink">{contact.name}</h2>
          {contact.do_not_contact ? <span className="mc-badge mc-badge-red">Ne plus écrire</span> : null}
        </div>
        <p className="text-[13px] text-warmgray">
          {[contact.city, contact.region].filter(Boolean).join(", ") || "Lieu non renseigné"}
          {contact.kind ? ` · ${contact.kind.replace(/_/g, " ")}` : ""}
          {contact.website ? (
            <> · <a className="inline-flex items-center gap-0.5 underline" href={contact.website} target="_blank" rel="noopener noreferrer">site<ExternalLink className="size-3" /></a></>
          ) : null}
        </p>
      </div>

      {/* 1. À toi */}
      {needsLeo.length > 0 ? (
        <Section title="À toi" hint="Les fils de ce lieu qui attendent une décision de ta part.">
          <AToiQueue items={needsLeo} now={now} />
        </Section>
      ) : null}

      {/* 2. Drafts */}
      <Section title="Brouillon en cours" hint="Premier mail et relance : modifiables tant qu'ils ne sont pas partis.">
        {draftThreads.length === 0 ? (
          <EmptyLine>Aucun brouillon pour ce lieu.</EmptyLine>
        ) : (
          <div className="flex flex-col gap-3">
            {draftThreads.map((t) => {
              const program = programs.find((p) => p.id === t.program_id);
              const draftStage = program ? stageByRole(program, "a_valider") : null;
              const msgs: DraftMessage[] = drafts
                .filter((m) => m.thread_id === t.id && (m.kind === "initial" || m.kind === "relance"))
                .map((m) => ({ id: m.id, kind: m.kind, text: m.body_text ?? m.draft_text ?? "", send_status: m.send_status ?? "", scheduled_for: m.scheduled_for }));
              return (
                <div key={t.id}>
                  <div className="mb-1 text-[11px] font-bold uppercase text-warmgray">{t.program_label}{t.article_title ? ` · ${t.article_title}` : ""}</div>
                  <DraftCard
                    threadId={t.id}
                    subject={t.email_subject}
                    isDraft={t.stage_role === "a_valider"}
                    draftSlug={draftStage?.slug ?? t.status}
                    messages={msgs}
                    isCustom={t.is_custom}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 3. Threads by program */}
      <Section title="Fils par programme">
        {threads.length === 0 ? (
          <EmptyLine>Aucun fil : ce lieu est à contacter.</EmptyLine>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>Programme</th><th>Objet</th><th>Étape</th><th>Article</th><th>Ouvert le</th></tr></thead>
              <tbody>
                {threads.map((t) => (
                  <tr key={t.id}>
                    <td>{t.program_label}</td>
                    <td><ThreadLink id={t.id}>{t.email_subject}</ThreadLink>
                      {t.external_type === "claim" ? (
                        <Link className="ml-2 text-[11px] underline" href="/admin/revendications">voir la revendication</Link>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      <StageBadge label={t.stage_label} role={t.stage_role} />
                      {t.closed_reason ? <span className="ml-1 text-[11px] text-warmgray">{CLOSED_REASON_LABELS[t.closed_reason]}</span> : null}
                      {t.needs_leo ? <span className="ml-1"><ReasonBadge reason={t.needs_leo_reason} /></span> : null}
                    </td>
                    <td className="max-w-[220px] truncate">{t.article_title ?? "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-warmgray">{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 4. Photos */}
      <Section title="Photos et justificatifs" hint="Accords photo écrits et fichiers déposés par le lieu (liens valables 10 minutes).">
        {grants.length === 0 ? (
          <EmptyLine>Aucun accord photo ni fichier pour ce lieu.</EmptyLine>
        ) : (
          <ul className="flex flex-col gap-3">
            {grants.map((g) => (
              <li key={g.id} className="rounded-xl border border-border bg-white p-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{g.licence}</span>
                  <span className="text-warmgray">crédit « {g.credit} »</span>
                  <span className={`mc-badge ${g.revoked_at ? "mc-badge-red" : "mc-badge-green"}`}>{g.revoked_at ? "Révoqué" : "En vigueur"}</span>
                </div>
                <div className="mt-1 text-[12px] text-warmgray">
                  Accordé par {g.granted_by_name} le {fmtDate(g.accepted_at)} · portée : {g.scope.replace(/_/g, " ")}
                  {g.revoked_reason ? ` · révocation : ${g.revoked_reason}` : ""}
                </div>
                {g.signedFiles.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {g.signedFiles.map((f, i) => (
                      <li key={i}>
                        {f.url ? <a className="mc-tag underline" href={f.url} target="_blank" rel="noopener noreferrer">{f.name}</a> : <span className="mc-tag">{f.name}</span>}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 5. Contact */}
      <Section title="Contact" hint="D'où vient chaque adresse : c'est ce qu'on répond à « comment avez-vous eu mon adresse ? ».">
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead><tr><th>Adresse</th><th>Personne</th><th>Source</th><th>État</th><th>Vérifiée</th></tr></thead>
            <tbody>
              {addresses.length === 0 ? (
                <tr><td colSpan={5} className="text-warmgray">Aucune adresse.</td></tr>
              ) : addresses.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}{a.is_primary ? <span className="ml-1.5 mc-badge mc-badge-lime">principale</span> : null}
                    {detail.suppressed.includes(a.email) ? <span className="ml-1.5 mc-badge mc-badge-red">supprimée</span> : null}</td>
                  <td>{[a.person_first_name, a.person_name].filter(Boolean).join(" ") || (a.is_role_address ? "Adresse générique" : "—")}{a.person_role ? <span className="text-[11px] text-warmgray"> · {a.person_role}</span> : null}</td>
                  <td>
                    {ADDRESS_SOURCE_LABELS[a.source] ?? a.source}
                    {a.source_url ? <> · <a className="underline" href={a.source_url} target="_blank" rel="noopener noreferrer">lien</a></> : null}
                    {a.source_note ? <div className="text-[11px] text-warmgray">{a.source_note}</div> : null}
                  </td>
                  <td>{a.status.replace(/_/g, " ")}</td>
                  <td className="text-[12px] text-warmgray">{a.verified_at ? fmtDate(a.verified_at) : "Non"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          <dt className="text-warmgray">Base légale</dt><dd>{contact.basis.replace(/_/g, " ")}</dd>
          <dt className="text-warmgray">Fiche sejour</dt><dd>{contact.sejour_place_slug ?? "—"}</dd>
          <dt className="text-warmgray">Organisation de l&apos;admin</dt><dd>{contact.organization_id ? "Rattachée" : "—"}</dd>
          <dt className="text-warmgray">Annuaire des lieux</dt><dd>{contact.annuaire_lieu_id ? "Rattaché" : "—"}</dd>
          {contact.do_not_contact ? (
            <>
              <dt className="text-warmgray">Ne plus écrire depuis</dt>
              <dd>{fmtDate(contact.do_not_contact_at)} ({contact.do_not_contact_source ?? "source inconnue"})</dd>
            </>
          ) : null}
          {contact.notes ? <><dt className="text-warmgray">Notes</dt><dd>{contact.notes}</dd></> : null}
        </dl>
      </Section>

      {/* 6. Timeline */}
      <Section title="Chronologie" hint="Les 60 derniers événements, tous programmes.">
        {events.length === 0 ? (
          <EmptyLine>Aucun événement.</EmptyLine>
        ) : (
          <ul className="divide-y divide-border text-[13px]">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span><span className="font-mono text-[12px]">{e.type}</span> <span className="text-[11px] text-warmgray">· {e.actor}</span></span>
                <span className="text-[11px] text-warmgray">{fmtDateTime(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
