"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  activateContext, addKnowledgeEntry, addProgramRedZone, createContextVersion, markContextReviewed, removeProgramRedZone,
  setKnowledgeActive, setProgramActive, setSubjectAuto, updateProgramIdentity, updateProgramSettings, updateStage,
} from "@/app/admin/contacts/actions";
import type {
  Mailbox, ProgramConfig, ProgramContext, RedZone, Subject, SubjectQualityRow,
} from "@/lib/outreach/types";
import { KIND_LABELS, type KnowledgeEntry, type KnowledgeKind } from "@/lib/outreach/knowledge";
import { EmptyLine, safeHref } from "./ui";

const dFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
const fmt = (iso: string | null) => (iso ? dFmt.format(new Date(iso)) : "—");

/** Shared plumbing: run an action, toast the outcome, refresh the page data. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, then?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(okText); then?.(); router.refresh(); }
      else toast.error(res.error ?? "Action impossible.");
    });
  }
  return { pending, run };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase text-warmgray">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-warmgray">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function IdentityTab({ program, mailbox }: { program: ProgramConfig; mailbox: Mailbox | null }) {
  const { pending, run } = useRun();
  const [label, setLabel] = useState(program.label);
  const [description, setDescription] = useState(program.description);
  const [senderName, setSenderName] = useState(program.sender_name);
  const [form, setForm] = useState<"tu" | "vous">(program.address_form);
  const [signature, setSignature] = useState(program.signature);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Libellé"><input className="mc-input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="Nom d'envoi" hint="Le nom affiché dans « De » : il vient du programme, pas de la boîte.">
        <input className="mc-input" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description"><textarea className="mc-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
      <Field label="Forme d'adresse">
        <select className="mc-input" value={form} onChange={(e) => setForm(e.target.value as "tu" | "vous")}>
          <option value="tu">Tutoiement</option>
          <option value="vous">Vouvoiement</option>
        </select>
      </Field>
      <Field label="Signature"><textarea className="mc-textarea" rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} /></Field>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] md:col-span-2">
        <dt className="text-warmgray">Sens</dt><dd>{program.direction === "sortant" ? "Sortant : on écrit d'abord" : "Entrant : on nous écrit d'abord"}</dd>
        <dt className="text-warmgray">Boîte</dt><dd>{mailbox ? `${mailbox.address} (${mailbox.personal ? "personnelle" : "de service"})` : program.mailbox_key}</dd>
        <dt className="text-warmgray">Sources d&apos;entrée</dt><dd>{program.entry_sources.join(", ")}</dd>
        <dt className="text-warmgray">Actions du lien signé</dt><dd>{program.link_actions.join(", ") || "aucune"}</dd>
        <dt className="text-warmgray">Articles</dt><dd>{program.uses_articles ? "Oui" : "Non"}</dd>
      </dl>

      <div className="md:col-span-2">
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}
          onClick={() => run(() => updateProgramIdentity(program.slug, { label, description, sender_name: senderName, address_form: form, signature }), "Identité enregistrée")}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context (versioned)
// ---------------------------------------------------------------------------

export function ContextTab({ program, contexts }: { program: ProgramConfig; contexts: ProgramContext[] }) {
  const { pending, run } = useRun();
  const base = contexts.find((c) => c.active) ?? contexts[0];
  const [body, setBody] = useState(base?.body ?? "");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-warmgray">
        Le contexte est le texte que l&apos;IA lit avant chaque réponse. Une version ne se modifie jamais : enregistrer en crée une nouvelle,
        inactive. Tu la relis, tu la marques « relue », puis tu l&apos;actives ; l&apos;ancienne reste consultable.
      </p>

      {contexts.length === 0 ? (
        <EmptyLine>Aucune version. Écris la première ci-dessous (200 caractères au moins).</EmptyLine>
      ) : (
        <div className="mc-table-wrap rounded-xl border border-border bg-white">
          <table className="mc-table">
            <thead><tr><th>Version</th><th>Écrite par</th><th>Créée le</th><th>Relue</th><th>Note</th><th /></tr></thead>
            <tbody>
              {contexts.map((c) => (
                <tr key={c.id} style={{ cursor: "default" }}>
                  <td className="font-semibold">v{c.version} {c.active ? <span className="ml-1 mc-badge mc-badge-green">active</span> : null}</td>
                  <td>{c.written_by}</td>
                  <td>{fmt(c.created_at)}</td>
                  <td>{c.reviewed_at ? `${fmt(c.reviewed_at)}${c.reviewed_by ? ` · ${c.reviewed_by}` : ""}` : <span className="mc-badge mc-badge-orange">à relire</span>}</td>
                  <td className="max-w-[240px] truncate" title={c.change_note ?? ""}>{c.change_note ?? "—"}</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mr-1.5" onClick={() => setOpen(open === c.id ? null : c.id)}>
                      {open === c.id ? "Masquer" : "Lire"}
                    </button>
                    {!c.reviewed_at ? (
                      <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mr-1.5" disabled={pending}
                        onClick={() => run(() => markContextReviewed(c.id), "Version marquée comme relue")}>Marquer relue</button>
                    ) : null}
                    {c.reviewed_at && !c.active ? (
                      <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}
                        onClick={() => run(() => activateContext(c.id), `Version ${c.version} activée`)}>Activer</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-cream p-4 text-[12.5px] leading-relaxed text-ink">
          {contexts.find((c) => c.id === open)?.body}
        </pre>
      ) : null}

      <div className="flex flex-col gap-2">
        <Field label={base ? `Nouvelle version (à partir de la v${base.version})` : "Première version"}>
          <textarea className="mc-textarea font-mono text-[12.5px]" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Note de version"><input className="mc-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ce qui change" /></Field>
        <div className="flex items-center gap-3">
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || body.trim().length < 200}
            onClick={() => run(() => createContextVersion(program.slug, body, note), "Nouvelle version enregistrée (inactive)", () => setNote(""))}>
            <Plus className="size-3.5" /> Enregistrer comme nouvelle version
          </button>
          <span className="text-[11px] text-warmgray">{body.trim().length} / 20 000 caractères</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export function SubjectsTab({ subjects, quality, minReviewed, editedThreshold }: {
  subjects: Subject[]; quality: SubjectQualityRow[]; minReviewed: number; editedThreshold: number;
}) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-warmgray">
        Une réponse automatique n&apos;est possible que pour un sujet hors zone rouge, une fois {minReviewed} réponses relues par toi
        et moins de {Math.round(editedThreshold * 100)} % de brouillons retouchés. Les réponses automatiques restent coupées pour l&apos;instant.
      </p>
      <div className="mc-table-wrap rounded-xl border border-border bg-white">
        <table className="mc-table">
          <thead><tr><th>Sujet</th><th>Zone rouge</th><th className="text-right">Relues</th><th className="text-right">Modifiées</th><th>Automatique</th></tr></thead>
          <tbody>
            {subjects.map((s) => {
              const q = quality.find((x) => x.subject_id === s.id);
              const relues = q?.relues_par_leo ?? 0;
              const part = q?.part_modifiee_20_dernieres ?? null;
              const missing: string[] = [];
              if (s.zone_rouge) missing.push("zone rouge : jamais en automatique");
              else {
                if (relues < minReviewed) missing.push(`il manque ${minReviewed - relues} réponse(s) relue(s)`);
                if (part === null) missing.push("part modifiée inconnue");
                else if (part >= editedThreshold) missing.push(`${Math.round(part * 100)} % modifiées, seuil ${Math.round(editedThreshold * 100)} %`);
              }
              const blocked = missing.length > 0;
              return (
                <tr key={s.id} style={{ cursor: "default" }}>
                  <td><span className="font-semibold">{s.label}</span><div className="text-[11px] text-warmgray">{s.slug}</div></td>
                  <td>{s.zone_rouge ? <span className="mc-badge mc-badge-red">rouge</span> : "—"}</td>
                  <td className="text-right">{relues}</td>
                  <td className="text-right">{part === null ? "—" : `${Math.round(part * 100)} %`}</td>
                  <td>
                    <label className="flex items-center gap-2" title={blocked && !s.auto_enabled ? missing.join(" ; ") : undefined}>
                      <input type="checkbox" checked={s.auto_enabled} disabled={pending || (blocked && !s.auto_enabled)}
                        onChange={(e) => run(() => setSubjectAuto(s.id, e.target.checked), e.target.checked ? "Automatique activé" : "Automatique coupé")} />
                      <span className={`text-[12px] ${blocked && !s.auto_enabled ? "text-warmgray" : ""}`}>
                        {s.auto_enabled ? "Activé" : blocked ? missing.join(" ; ") : "Coupé"}
                      </span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Red zones
// ---------------------------------------------------------------------------

export function RedZonesTab({ program, zones }: { program: ProgramConfig; zones: RedZone[] }) {
  const { pending, run } = useRun();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const universal = zones.filter((z) => z.program_id === null);
  const own = zones.filter((z) => z.program_id === program.id);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 text-[12px] font-bold uppercase text-warmgray">Universelles (lecture seule)</h3>
        <ul className="divide-y divide-border rounded-xl border border-border bg-white text-[13px]">
          {universal.map((z) => (
            <li key={z.id} className="px-4 py-2"><span className="font-semibold">{z.label}</span> <span className="font-mono text-[11px] text-warmgray">{z.code}</span><div className="text-[12px] text-warmgray">{z.description}</div></li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-[12px] font-bold uppercase text-warmgray">Propres au programme</h3>
        {own.length === 0 ? <EmptyLine>Aucune zone rouge propre à ce programme.</EmptyLine> : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-white text-[13px]">
            {own.map((z) => (
              <li key={z.id} className="flex items-start justify-between gap-3 px-4 py-2">
                <div><span className="font-semibold">{z.label}</span> <span className="font-mono text-[11px] text-warmgray">{z.code}</span><div className="text-[12px] text-warmgray">{z.description}</div></div>
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending} aria-label={`Retirer ${z.label}`}
                  onClick={() => run(() => removeProgramRedZone(z.id), "Zone rouge retirée")}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <Field label="Code" hint="Lettres minuscules et _"><input className="mc-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="modification_article" /></Field>
        <Field label="Libellé"><input className="mc-input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="Description"><textarea className="mc-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
        <div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !code || !label || !description}
            onClick={() => run(() => addProgramRedZone(program.slug, { code, label, description }), "Zone rouge ajoutée", () => { setCode(""); setLabel(""); setDescription(""); })}>
            <Plus className="size-3.5" /> Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge base (step 7)
// ---------------------------------------------------------------------------

function KnowledgeRow({ entry, subjects }: { entry: KnowledgeEntry; subjects: Subject[] }) {
  const { pending, run } = useRun();
  const href = safeHref(entry.source_url);
  const subject = subjects.find((s) => s.id === entry.subject_id);
  return (
    <li className={`px-4 py-3 ${entry.active ? "" : "bg-cream/60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mc-badge mc-badge-gray">{KIND_LABELS[entry.kind]}</span>
            <span className="mc-badge mc-badge-gray">{entry.program_id === null ? "Partagée" : "Ce programme"}</span>
            {subject ? <span className="mc-badge mc-badge-gray">{subject.label}</span> : null}
            {!entry.active ? <span className="mc-badge mc-badge-red">Désactivée</span> : null}
            {entry.active && !entry.reviewed_at ? <span className="mc-badge mc-badge-red">Non relue</span> : null}
            <span className="font-semibold">{entry.title}</span>
          </div>
          {entry.question ? <div className="mt-0.5 text-[12px] text-warmgray">Question : {entry.question}</div> : null}
          {href ? <a className="text-[12px] underline" href={href} target="_blank" rel="noopener noreferrer">{entry.source_url}</a> : null}
          <details className="mt-1 text-[12px] text-warmgray">
            <summary className="cursor-pointer">Texte ({entry.body.length} caractères)</summary>
            <p className="mt-1 whitespace-pre-wrap text-ink">{entry.body}</p>
          </details>
        </div>
        <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}
          onClick={() => run(() => setKnowledgeActive(entry.id, !entry.active), entry.active ? "Entrée désactivée" : "Entrée activée")}>
          {entry.active ? "Désactiver" : "Activer"}
        </button>
      </div>
    </li>
  );
}

export function KnowledgeTab({ program, entries, subjects }: { program: ProgramConfig; entries: KnowledgeEntry[]; subjects: Subject[] }) {
  const { pending, run } = useRun();
  const [kind, setKind] = useState<Exclude<KnowledgeKind, "approuvee">>("page");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [shared, setShared] = useState(true);
  const [subjectId, setSubjectId] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-warmgray">
        Ce que l&apos;IA a le droit de dire. Elle n&apos;utilise que ces entrées, partagées ou propres à {program.label} : ce
        qui n&apos;y figure pas est une zone rouge « hors base ». Les réponses approuvées s&apos;ajoutent depuis un fil, après ta réponse.
      </p>
      {entries.length === 0 ? <EmptyLine>La base est vide : l&apos;IA laissera tout à Léo.</EmptyLine> : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-white text-[13px]">
          {entries.map((e) => <KnowledgeRow key={e.id} entry={e} subjects={subjects} />)}
        </ul>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Type">
          <select className="mc-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="page">Page du site</option>
            <option value="corpus">Corpus (texte de référence)</option>
            <option value="regle">Règle</option>
          </select>
        </Field>
        <Field label="Titre"><input className="mc-input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="Texte" hint="Résumé de 300 à 600 mots pour une page. 8 000 caractères au plus.">
            <textarea className="mc-textarea" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <Field label="Adresse source (facultative)"><input className="mc-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://sejour.casaminga.com/…" /></Field>
        <Field label="Lié à un sujet (facultatif)">
          <select className="mc-input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); if (e.target.value) setShared(false); }}>
            <option value="">Aucun</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[12px] text-warmgray">
          <input type="checkbox" checked={shared} disabled={!!subjectId} onChange={(e) => setShared(e.target.checked)} />
          Partagée avec tous les programmes
        </label>
        <div className="md:col-span-2">
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !title.trim() || !body.trim()}
            onClick={() => run(() => addKnowledgeEntry(program.slug, { kind, title, body, sourceUrl, shared, subjectId }), "Entrée ajoutée",
              () => { setTitle(""); setBody(""); setSourceUrl(""); setSubjectId(""); })}>
            <Plus className="size-3.5" /> Ajouter à la base
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stages and transitions
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<string, string> = {
  a_valider: "à valider", planifie: "planifié", attente: "attente de réponse", relance: "relancé", nouveau: "nouveau",
  conversation: "conversation", resolu: "résolu", succes: "succès", clos: "clos",
};

function StageRow({ program, stage }: { program: ProgramConfig; stage: ProgramConfig["stages"][number] }) {
  const { pending, run } = useRun();
  const [label, setLabel] = useState(stage.label);
  const [position, setPosition] = useState(String(stage.position));
  const [onBoard, setOnBoard] = useState(stage.on_board);
  const changed = label !== stage.label || Number(position) !== stage.position || onBoard !== stage.on_board;
  return (
    <tr style={{ cursor: "default" }}>
      <td><span className="font-mono text-[12px]">{stage.slug}</span><div className="text-[11px] text-warmgray">{ROLE_LABEL[stage.role]}</div></td>
      <td><input className="mc-input" value={label} onChange={(e) => setLabel(e.target.value)} aria-label={`Libellé de ${stage.slug}`} /></td>
      <td><input className="mc-input !w-20" type="number" value={position} onChange={(e) => setPosition(e.target.value)} aria-label={`Position de ${stage.slug}`} /></td>
      <td><input type="checkbox" checked={onBoard} onChange={(e) => setOnBoard(e.target.checked)} aria-label={`${stage.slug} au tableau`} /></td>
      <td>{changed ? (
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}
          onClick={() => run(() => updateStage(program.slug, stage.slug, { label, position: Number(position), on_board: onBoard }), "Étape enregistrée")}>Enregistrer</button>
      ) : null}</td>
    </tr>
  );
}

export function StagesTab({ program, missing }: { program: ProgramConfig; missing: string[] }) {
  const stages = [...program.stages].sort((a, b) => a.position - b.position);
  const label = (slug: string) => stages.find((s) => s.slug === slug)?.label ?? slug;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-warmgray">
        Tu changes les libellés, l&apos;ordre et la présence au tableau. Le rôle de chaque étape est fixe : c&apos;est ce que le moteur comprend.
        {missing.some((m) => m.startsWith("etapes")) ? " Les étapes sont actuellement incomplètes." : ""}
      </p>
      <div className="mc-table-wrap rounded-xl border border-border bg-white">
        <table className="mc-table">
          <thead><tr><th>Étape</th><th>Libellé</th><th>Position</th><th>Au tableau</th><th /></tr></thead>
          <tbody>{stages.map((s) => <StageRow key={s.slug + s.label + s.position + String(s.on_board)} program={program} stage={s} />)}</tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-2 text-[12px] font-bold uppercase text-warmgray">Transitions autorisées</h3>
        <div className="mc-table-wrap rounded-xl border border-border bg-white">
          <table className="mc-table">
            <thead><tr><th>De</th><th>Vers</th><th>Acteurs</th></tr></thead>
            <tbody>
              {[...program.transitions]
                .sort((a, b) => (stages.findIndex((s) => s.slug === a.from_slug) - stages.findIndex((s) => s.slug === b.from_slug)))
                .map((t) => (
                  <tr key={t.from_slug + t.to_slug} style={{ cursor: "default" }}>
                    <td>{label(t.from_slug)}</td><td>{label(t.to_slug)}</td><td className="text-[12px] text-warmgray">{t.actors.join(", ")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-warmgray">La liste des transitions est en lecture seule : la modifier demande de vérifier le moteur.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation and pace
// ---------------------------------------------------------------------------

const NUMERIC_FIELDS: { key: string; label: string; hint?: string; step?: string; outbound?: boolean }[] = [
  { key: "follow_up_after_days", label: "Relance après (jours)", outbound: true },
  { key: "max_follow_ups", label: "Relances au plus", outbound: true },
  { key: "close_after_days", label: "Clôture sans suite après (jours)" },
  { key: "min_days_between_threads", label: "Jours entre deux fils vers un même contact", outbound: true },
  { key: "sla_first_response_hours", label: "Première réponse sous (heures)" },
  { key: "resolved_autoclose_days", label: "Clôture des résolus après (jours)" },
  { key: "link_ttl_days", label: "Durée des liens signés (jours)" },
  { key: "retention_months", label: "Conservation (mois)" },
  { key: "daily_cap", label: "Plafond froid par jour", outbound: true },
  { key: "per_run_cap", label: "Envois froids par passage", outbound: true },
  { key: "confidence_threshold", label: "Seuil de confiance", step: "0.01" },
  { key: "auto_streak_limit", label: "Réponses automatiques d'affilée au plus" },
  { key: "auto_reply_delay_min", label: "Délai avant envoi automatique (min)" },
  { key: "auto_min_reviewed", label: "Réponses relues avant de passer en automatique" },
  { key: "edited_threshold", label: "Part de brouillons modifiés tolérée", step: "0.01", hint: "0,30 = 30 %" },
];

export function SettingsTab({ program }: { program: ProgramConfig }) {
  const { pending, run } = useRun();
  const s = program.settings;
  const initial: Record<string, string> = {};
  if (s) {
    for (const f of NUMERIC_FIELDS) initial[f.key] = String((s as unknown as Record<string, number>)[f.key]);
    initial.send_start = s.send_start.slice(0, 5);
    initial.send_end = s.send_end.slice(0, 5);
    initial.ramp_started_on = s.ramp_started_on ?? "";
  }
  const [vals, setVals] = useState(initial);
  if (!s) return <EmptyLine>Ce programme n&apos;a pas de réglages.</EmptyLine>;

  function save() {
    const patch: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v === initial[k]) continue;
      if (k === "send_start" || k === "send_end") patch[k] = v;
      else if (k === "ramp_started_on") patch[k] = v || null;
      else patch[k] = Number(v);
    }
    if (Object.keys(patch).length === 0) { toast.info("Rien à enregistrer."); return; }
    run(() => updateProgramSettings(program.slug, patch), "Réglages enregistrés");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border bg-white px-4 py-2.5 text-[13px]">
        Réponses automatiques : <strong>{s.auto_send_enabled ? "activées" : "coupées"}</strong>. Elles restent coupées tant que l&apos;IA n&apos;est pas branchée ;
        l&apos;interrupteur général n&apos;est pas modifiable ici.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {NUMERIC_FIELDS.filter((f) => program.direction === "sortant" || !f.outbound).map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input className="mc-input" type="number" step={f.step ?? "1"} value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
          </Field>
        ))}
        <Field label="Début de la fenêtre d'envoi"><input className="mc-input" type="time" value={vals.send_start ?? ""} onChange={(e) => setVals((v) => ({ ...v, send_start: e.target.value }))} /></Field>
        <Field label="Fin de la fenêtre d'envoi"><input className="mc-input" type="time" value={vals.send_end ?? ""} onChange={(e) => setVals((v) => ({ ...v, send_end: e.target.value }))} /></Field>
        {program.direction === "sortant" ? (
          <Field label="Début de la montée en charge" hint={`Rampe : ${s.ramp_steps.join(" / ")} par jour`}>
            <input className="mc-input" type="date" value={vals.ramp_started_on ?? ""} onChange={(e) => setVals((v) => ({ ...v, ramp_started_on: e.target.value }))} />
          </Field>
        ) : null}
      </div>
      <p className="text-[11px] text-warmgray">Jours d&apos;envoi : {s.send_days.join(", ")} (1 = lundi) · fuseau {s.timezone}. Chaque modification est journalisée.</p>
      <div><button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending} onClick={save}>Enregistrer les réglages</button></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

const MISSING_LABEL: Record<string, string> = {
  programme_inconnu: "Programme inconnu",
  contexte_actif_manquant: "Aucun contexte actif : écris-le, relis-le, puis active-le dans l'onglet Contexte",
  reglages_manquants: "Réglages manquants",
  sujet_autre_manquant: "Le sujet « autre » (en zone rouge) est obligatoire",
  etapes_sortant_incompletes: "Étapes du pipeline sortant incomplètes",
  etapes_entrant_incompletes: "Étapes du pipeline entrant incomplètes",
};

export function ActivationTab({ program, missing, mailbox }: { program: ProgramConfig; missing: string[]; mailbox: Mailbox | null }) {
  const { pending, run } = useRun();
  const ready = missing.length === 0;
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <p>
        Ce programme est actuellement{" "}
        <span className={`mc-badge ${program.active ? "mc-badge-green" : "mc-badge-gray"}`}>{program.active ? "actif" : "inactif"}</span>.
        La base refuse d&apos;activer un programme incomplet.
      </p>
      {ready ? (
        <p className="flex items-center gap-2 text-emerald-700"><Check className="size-4" /> Rien ne manque : le programme peut être activé.</p>
      ) : (
        <ul className="list-disc rounded-xl border border-amber-200 bg-amber-50 py-3 pl-8 pr-4 text-amber-900">
          {missing.map((m) => <li key={m}>{MISSING_LABEL[m] ?? m}</li>)}
        </ul>
      )}
      {mailbox ? (
        <p className="text-warmgray">
          Boîte {mailbox.address} : {mailbox.active ? "active" : "inactive"}{mailbox.paused ? " (en pause)" : ""}.
          {!mailbox.active ? " Tant qu'elle est inactive, aucun message ne peut être planifié (garde-fou de la base) : elle s'active avec la mise en place de l'envoi." : ""}
        </p>
      ) : null}
      <div className="flex gap-2">
        {program.active ? (
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}
            onClick={() => run(() => setProgramActive(program.slug, false), "Programme désactivé")}>Désactiver</button>
        ) : (
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !ready}
            onClick={() => run(() => setProgramActive(program.slug, true), "Programme activé")}>Activer le programme</button>
        )}
      </div>
    </div>
  );
}
