import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getOverview } from "@/lib/outreach/data";
import type { OverviewAlert, ProgramStatsRow } from "@/lib/outreach/types";
import { AToiQueue } from "@/components/outreach/a-toi-queue";
import { PauseControls } from "@/components/outreach/pause-controls";
import { EmptyLine, ProgramSelector, Section, Stat, fmtDate, num, pct } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ programme?: string }> };

const ALERT_STYLE: Record<OverviewAlert["level"], { cls: string; Icon: typeof Info }> = {
  danger: { cls: "border-red-200 bg-red-50 text-red-800", Icon: OctagonAlert },
  warn: { cls: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  info: { cls: "border-border bg-white text-ink", Icon: Info },
};

function totalRow(stats: ProgramStatsRow[]) {
  const sum = (k: "fils" | "actifs" | "a_toi" | "succes" | "contactes" | "ont_repondu" | "hors_delai") =>
    stats.reduce((n, s) => n + (s[k] ?? 0), 0);
  const contactes = sum("contactes");
  return {
    fils: sum("fils"), actifs: sum("actifs"), a_toi: sum("a_toi"), succes: sum("succes"),
    contactes, ont_repondu: sum("ont_repondu"), hors_delai: sum("hors_delai"),
    taux: contactes > 0 ? Math.round((1000 * sum("ont_repondu")) / contactes) / 10 : null,
  };
}

export default async function ContactsHomePage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const { programme } = await searchParams;
  const requested = programme && programme !== "tous" ? programme : null;
  const ov = await getOverview(requested);
  const current = requested && ov.programs.some((p) => p.slug === requested) ? requested : null;
  const now = Date.now();
  const total = totalRow(ov.stats);

  return (
    <div className="flex flex-col gap-5">
      <ProgramSelector programs={ov.programs} current={current} basePath="/admin/contacts" />

      {/* Alerts */}
      {ov.alerts.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Alertes">
          {ov.alerts.map((a, i) => {
            const { cls, Icon } = ALERT_STYLE[a.level];
            return (
              <li key={i} className={`flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] ${cls}`}>
                <Icon className="mt-0.5 size-4 shrink-0" />
                {a.href ? <Link href={a.href} className="underline underline-offset-2">{a.text}</Link> : <span>{a.text}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-border bg-white px-4 py-2.5 text-[13px] text-warmgray">Aucune alerte.</p>
      )}

      {/* Counters */}
      <div className="mc-kpi-grid">
        <Stat label="À toi" value={num(total.a_toi)} tone={total.a_toi > 0 ? "danger" : undefined} />
        <Stat label="Fils actifs" value={num(total.actifs)} sub={`${num(total.fils)} au total`} />
        <Stat label="Taux de réponse" value={pct(total.taux)} sub={`${num(total.ont_repondu)} sur ${num(total.contactes)} contactés`} />
        <Stat label="Succès" value={num(total.succes)} tone={total.succes > 0 ? "ok" : undefined} />
        <Stat label="Audience" value={num(ov.audience.contacts)} sub={`${num(ov.audience.joignables)} joignables · ${num(ov.audience.ne_plus_ecrire)} « ne plus écrire »`} />
      </div>

      {/* Mailbox health */}
      <Section title="Santé d'envoi" hint="Par boîte : c'est l'adresse et le domaine qui portent la réputation.">
        {ov.mailboxes.length === 0 ? (
          <EmptyLine>Aucune boîte à afficher.</EmptyLine>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ov.mailboxes.map((m) => (
              <div key={m.mailbox_key} className="rounded-xl border border-border bg-white p-4 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{m.address}</div>
                    <div className="text-[11px] text-warmgray">{m.programSlugs.join(", ") || "aucun programme"}</div>
                  </div>
                  <span className={`mc-badge ${m.paused ? "mc-badge-red" : m.active ? "mc-badge-green" : "mc-badge-gray"}`}>
                    {m.paused ? "En pause" : m.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-warmgray">Envoyés aujourd&apos;hui</dt>
                  <dd className="text-right font-medium">{m.envois_aujourdhui} / {m.hard_daily_cap}</dd>
                  <dt className="text-warmgray">En file</dt>
                  <dd className="text-right font-medium">{m.file_attente}</dd>
                  <dt className="text-warmgray">Rebonds</dt>
                  <dd className="text-right font-medium">{m.rebonds} ({m.taux_rebond === null ? "—" : `${(m.taux_rebond * 100).toFixed(1)} %`})</dd>
                  <dt className="text-warmgray">Plaintes</dt>
                  <dd className="text-right font-medium">{m.plaintes} ({m.taux_plainte === null ? "—" : `${(m.taux_plainte * 100).toFixed(2)} %`})</dd>
                  <dt className="text-warmgray">Désinscriptions</dt>
                  <dd className="text-right font-medium">{m.desinscriptions}</dd>
                </dl>
                {m.missingVars.length > 0 ? (
                  <p className="mt-2 text-[11px] text-warmgray">Variables absentes du serveur : {m.missingVars.join(", ")}.</p>
                ) : null}
                <div className="mt-3">
                  <PauseControls kind="boite" id={m.mailbox_key} paused={m.paused} label={m.address} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Programs */}
      <Section title="Programmes" hint="Une ligne par programme, et le total.">
        {ov.stats.length === 0 ? (
          <EmptyLine>Aucun programme.</EmptyLine>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Programme</th><th>État</th><th className="text-right">Actifs</th><th className="text-right">À toi</th>
                  <th className="text-right">Succès</th><th className="text-right">Réponse</th><th className="text-right">Délai médian</th>
                  <th className="text-right">Hors délai</th><th />
                </tr>
              </thead>
              <tbody>
                {ov.stats.map((s) => {
                  const program = ov.programs.find((p) => p.id === s.program_id);
                  return (
                    <tr key={s.program_id}>
                      <td>
                        <Link href={`/admin/contacts/reglages?programme=${s.slug}`} className="font-semibold text-ink hover:text-coral-dark">{s.label}</Link>
                        <div className="text-[11px] text-warmgray">{s.direction === "sortant" ? "On écrit d'abord" : "On nous écrit d'abord"}</div>
                      </td>
                      <td>
                        {program?.settings?.paused ? <span className="mc-badge mc-badge-red">En pause</span>
                          : s.active ? <span className="mc-badge mc-badge-green">Actif</span> : <span className="mc-badge mc-badge-gray">Inactif</span>}
                      </td>
                      <td className="text-right">{num(s.actifs)}</td>
                      <td className="text-right">{num(s.a_toi)}</td>
                      <td className="text-right">{num(s.succes)}</td>
                      <td className="text-right">{s.direction === "sortant" ? pct(s.taux_reponse_pct) : "—"}</td>
                      <td className="text-right">{s.direction === "entrant" && s.premiere_reponse_h_mediane !== null ? `${s.premiere_reponse_h_mediane} h` : "—"}</td>
                      <td className="text-right">{s.direction === "entrant" ? num(s.hors_delai) : "—"}</td>
                      <td className="text-right">
                        {program ? <PauseControls kind="programme" id={s.slug} paused={!!program.settings?.paused} label={s.label} /> : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td>Total</td><td />
                  <td className="text-right">{num(total.actifs)}</td>
                  <td className="text-right">{num(total.a_toi)}</td>
                  <td className="text-right">{num(total.succes)}</td>
                  <td className="text-right">{pct(total.taux)}</td>
                  <td className="text-right">—</td>
                  <td className="text-right">{num(total.hors_delai)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* À toi */}
      <Section id="a-toi" title="À toi" hint="Les fils qui attendent une décision ou une réponse de ta part, les plus anciens d'abord.">
        <AToiQueue items={ov.queue} now={now} />
      </Section>

      {/* AI quality */}
      <Section title="Qualité de l'IA" hint="Par sujet : ce que l'IA a reçu, ce qu'elle aurait fait, et la part de ses brouillons que tu retouches (20 derniers).">
        {ov.quality.every((q) => q.recus === 0 && q.relues_par_leo === 0) ? (
          <EmptyLine>Aucun message n&apos;a encore été lu par l&apos;IA.</EmptyLine>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Programme</th><th>Sujet</th><th className="text-right">Reçus</th><th className="text-right">Auto</th>
                  <th className="text-right">À toi</th><th className="text-right">Confiance</th><th className="text-right">Relues</th>
                  <th className="text-right">Modifiées</th><th>Auto</th>
                </tr>
              </thead>
              <tbody>
                {ov.quality.filter((q) => q.recus > 0 || q.relues_par_leo > 0).map((q) => (
                  <tr key={q.subject_id}>
                    <td>{q.program_slug}</td>
                    <td>{q.label}{q.zone_rouge ? <span className="ml-1.5 mc-badge mc-badge-red">rouge</span> : null}</td>
                    <td className="text-right">{q.recus}</td>
                    <td className="text-right">{q.decisions_auto}</td>
                    <td className="text-right">{q.decisions_a_toi}</td>
                    <td className="text-right">{q.confiance_moyenne ?? "—"}</td>
                    <td className="text-right">{q.relues_par_leo}</td>
                    <td className="text-right">{q.part_modifiee_20_dernieres === null ? "—" : `${Math.round(q.part_modifiee_20_dernieres * 100)} %`}</td>
                    <td>{q.auto_enabled ? <span className="mc-badge mc-badge-green">activé</span> : <span className="mc-badge mc-badge-gray">coupé</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Results */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Résultats par article">
          {ov.articles.length === 0 ? (
            <EmptyLine>Aucun article n&apos;a encore de contacts.</EmptyLine>
          ) : (
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Article</th><th className="text-right">Fils</th><th className="text-right">Contactés</th>
                    <th className="text-right">Réponses</th><th className="text-right">Photos</th><th className="text-right">Partenaires</th>
                    <th className="text-right">Stop</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.articles.map((a) => (
                    <tr key={`${a.program_id}-${a.article_id}`}>
                      <td className="max-w-[260px] truncate" title={a.title}>{a.title}</td>
                      <td className="text-right">{a.fils}</td>
                      <td className="text-right">{a.contactes}</td>
                      <td className="text-right">{a.ont_repondu} ({pct(a.taux_reponse_pct)})</td>
                      <td className="text-right">{a.photos}</td>
                      <td className="text-right">{a.partenaires}</td>
                      <td className="text-right">{a.ne_plus_ecrire}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Résultats par semaine" hint="Douze dernières semaines.">
          {ov.weekly.length === 0 ? (
            <EmptyLine>Aucune activité enregistrée.</EmptyLine>
          ) : (
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Semaine du</th><th className="text-right">Premiers mails</th><th className="text-right">Relances</th>
                    <th className="text-right">Tes réponses</th><th className="text-right">Reçus</th><th className="text-right">Rebonds</th>
                    <th className="text-right">Stop</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.weekly.map((w) => (
                    <tr key={w.semaine}>
                      <td>{fmtDate(w.semaine + "T12:00:00Z")}</td>
                      <td className="text-right">{w.premiers_contacts}</td>
                      <td className="text-right">{w.relances}</td>
                      <td className="text-right">{w.reponses_leo}</td>
                      <td className="text-right">{w.messages_recus}</td>
                      <td className="text-right">{w.rebonds}</td>
                      <td className="text-right">{w.desinscriptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
