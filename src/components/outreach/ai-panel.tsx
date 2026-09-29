import type { Message, ProgramConfig, RedZone, Subject, Thread } from "@/lib/outreach/types";
import { EmptyLine } from "./ui";

const DECISION_LABEL: Record<string, string> = {
  auto: "Aurait répondu seule",
  a_toi: "Te laisse la main",
  ignore: "Ignoré",
};

/**
 * Panel "lecture par l'IA": what the AI understood of the latest received
 * message. Display only; the AI itself arrives in step 7.
 */
export function AiPanel({ message, thread, subjects, redZones, contextVersion, programs }: {
  message: Message | null;
  thread: Thread;
  subjects: Subject[];
  redZones: RedZone[];
  contextVersion: number | null;
  programs: ProgramConfig[];
}) {
  if (!message || !message.classified_at) {
    return (
      <EmptyLine>
        Aucun message de ce fil n&apos;a encore été lu par l&apos;IA.
        {message?.ai_error ? " La lecture a échoué." : ""}
      </EmptyLine>
    );
  }
  const subject = subjects.find((s) => s.id === message.ai_subject_id);
  const zoneLabels = message.ai_red_zones.map((code) => redZones.find((z) => z.code === code)?.label ?? code);
  const triaged = message.ai_triage_program_id ? programs.find((p) => p.id === message.ai_triage_program_id) : null;

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      {message.ai_summary ? <p className="text-ink">{message.ai_summary}</p> : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-warmgray">Sujet</dt>
        <dd>{subject ? subject.label : "—"}{subject?.zone_rouge ? <span className="ml-1.5 mc-badge mc-badge-red">zone rouge</span> : null}</dd>
        <dt className="text-warmgray">Intention</dt>
        <dd>{message.ai_intent ?? "—"}</dd>
        <dt className="text-warmgray">Confiance</dt>
        <dd>{message.ai_confidence === null ? "—" : `${Math.round(message.ai_confidence * 100)} %`}</dd>
        <dt className="text-warmgray">Zones rouges</dt>
        <dd>{zoneLabels.length ? zoneLabels.map((z) => <span key={z} className="mr-1 mc-badge mc-badge-red">{z}</span>) : "Aucune"}</dd>
        <dt className="text-warmgray">Sources</dt>
        <dd>{message.ai_sources.length ? `${message.ai_sources.length} entrée(s) de la base de connaissances` : "Aucune (hors base)"}</dd>
        <dt className="text-warmgray">Contexte</dt>
        <dd>version {message.ai_context_version ?? contextVersion ?? "—"}{message.ai_model ? ` · ${message.ai_model}` : ""}</dd>
        <dt className="text-warmgray">Décision</dt>
        <dd>{message.ai_decision ? DECISION_LABEL[message.ai_decision] : "—"}</dd>
        {message.ai_decision_reasons.length ? (
          <>
            <dt className="text-warmgray">Pourquoi</dt>
            <dd>{message.ai_decision_reasons.map((r) => r.replace(/_/g, " ")).join(", ")}</dd>
          </>
        ) : null}
        {message.ai_opt_out ? (
          <>
            <dt className="text-warmgray">Opposition</dt>
            <dd><span className="mc-badge mc-badge-red">Demande de ne plus écrire détectée</span></dd>
          </>
        ) : null}
        {triaged || thread.triage_confidence !== null ? (
          <>
            <dt className="text-warmgray">Tri du programme</dt>
            <dd>{triaged?.label ?? "—"}{thread.triage_confidence !== null ? ` · confiance ${Math.round(thread.triage_confidence * 100)} %` : ""}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
