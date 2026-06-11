import Link from "next/link";
import { Scale, HeartHandshake, Palette, Landmark, ArrowRight } from "lucide-react";
import type { Meeting, MembershipCampaign, Residence, Grant } from "@/lib/types";
import { formatAmount } from "@/lib/finances-meta";

/**
 * Blocs apportés par les modules activés (couche 3 du dashboard adaptatif).
 * Composants serveur purs — la page décide lesquels rendre et dans quel ordre.
 */

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function BlockShell({ icon, title, sub, href, children }: {
  icon: React.ReactNode; title: string; sub: string; href: string; children: React.ReactNode;
}) {
  return (
    <div className="mc-card px-[22px] py-5">
      <div className="mc-dash-card-head">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-warmgray">{icon}</span>
          <div>
            <h3 className="mc-dash-h3">{title}</h3>
            <div className="mc-dash-card-sub">{sub}</div>
          </div>
        </div>
        <Link href={href} className="mc-dash-pill hover:underline">
          Tout voir →
        </Link>
      </div>
      {children}
    </div>
  );
}

const MEETING_TYPE_FR: Record<string, string> = {
  ag: "Assemblée Générale", ca: "Conseil d'Administration", bureau: "Bureau", autre: "Réunion",
};

// ── Gouvernance : prochaine instance ─────────────────────────────────────────
export function NextMeetingBlock({ orgSlug, meeting }: { orgSlug: string; meeting: Meeting | null }) {
  return (
    <BlockShell
      icon={<Scale className="size-[17px]" strokeWidth={1.8} />}
      title="Prochaine instance"
      sub="CA, AG, bureau — préparez vos réunions."
      href={`/dashboard/${orgSlug}/gouvernance`}
    >
      {meeting ? (
        <Link
          href={`/dashboard/${orgSlug}/gouvernance`}
          className="flex items-center gap-3 rounded-[14px] bg-gray-light px-4 py-3.5 transition-colors hover:bg-peach-pale/60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mc-badge bg-indigo-100 text-indigo-700">{MEETING_TYPE_FR[meeting.type] ?? "Réunion"}</span>
              <span className="truncate text-[13px] font-semibold text-foreground">{meeting.title}</span>
            </div>
            <p className="mt-1 text-[12px] text-warmgray">
              {fmtDate(meeting.date)}{meeting.agenda ? " · ordre du jour prêt" : " · ordre du jour à rédiger"}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-warmgray" />
        </Link>
      ) : (
        <div className="rounded-[14px] border border-dashed border-peach px-5 py-6 text-center text-sm text-warmgray">
          Aucune réunion planifiée. <Link href={`/dashboard/${orgSlug}/gouvernance`} className="font-medium text-coral-dark hover:underline">Planifier →</Link>
        </div>
      )}
    </BlockShell>
  );
}

// ── Adhésions : campagne en cours ────────────────────────────────────────────
export function MembershipCampaignBlock({ orgSlug, campaign, confirmedCount, collected }: {
  orgSlug: string;
  campaign: MembershipCampaign | null;
  confirmedCount: number;
  collected: number;
}) {
  const max = campaign?.max_members ?? null;
  const pct = max ? Math.min(100, Math.round((confirmedCount / max) * 100)) : null;
  return (
    <BlockShell
      icon={<HeartHandshake className="size-[17px]" strokeWidth={1.8} />}
      title="Campagne d'adhésion"
      sub="Progression de la campagne publiée."
      href={`/dashboard/${orgSlug}/adhesions`}
    >
      {campaign ? (
        <div className="rounded-[14px] bg-gray-light px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-semibold text-foreground">{campaign.title}</span>
            <span className="shrink-0 text-[12px] text-warmgray">
              {confirmedCount} adhérent{confirmedCount > 1 ? "s" : ""}{max ? ` / ${max}` : ""}
            </span>
          </div>
          {pct !== null && (
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-2 text-[12px] text-warmgray">{formatAmount(collected)} collectés</p>
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-peach px-5 py-6 text-center text-sm text-warmgray">
          Aucune campagne publiée. <Link href={`/dashboard/${orgSlug}/adhesions`} className="font-medium text-coral-dark hover:underline">Créer →</Link>
        </div>
      )}
    </BlockShell>
  );
}

// ── Résidences : séjours en cours ────────────────────────────────────────────
export function ResidencesBlock({ orgSlug, residences }: { orgSlug: string; residences: Residence[] }) {
  const shown = residences.slice(0, 3);
  return (
    <BlockShell
      icon={<Palette className="size-[17px]" strokeWidth={1.8} />}
      title="Résidences en cours"
      sub="Artistes actuellement accueillis."
      href={`/dashboard/${orgSlug}/residences`}
    >
      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-peach px-5 py-6 text-center text-sm text-warmgray">
          Aucune résidence en cours.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shown.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/${orgSlug}/residences`}
              className="flex items-center gap-3 rounded-[14px] bg-gray-light px-3.5 py-2.5 transition-colors hover:bg-peach-pale/60"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">{r.title}</span>
                <span className="text-[12px] text-warmgray">
                  {r.discipline}{r.end_date ? ` · jusqu'au ${fmtDate(r.end_date)}` : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BlockShell>
  );
}

// ── Subventions : échéances de reporting ─────────────────────────────────────
export function GrantDeadlinesBlock({ orgSlug, grants }: { orgSlug: string; grants: Grant[] }) {
  const shown = grants.slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <BlockShell
      icon={<Landmark className="size-[17px]" strokeWidth={1.8} />}
      title="Échéances subventions"
      sub="Reportings à rendre prochainement."
      href={`/dashboard/${orgSlug}/subventions`}
    >
      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-peach px-5 py-6 text-center text-sm text-warmgray">
          Aucune échéance dans les 60 jours.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shown.map((g) => {
            const overdue = !!g.reporting_due_date && g.reporting_due_date < today;
            return (
              <Link
                key={g.id}
                href={`/dashboard/${orgSlug}/subventions`}
                className="flex items-center gap-3 rounded-[14px] bg-gray-light px-3.5 py-2.5 transition-colors hover:bg-peach-pale/60"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{g.title}</span>
                  <span className="text-[12px] text-warmgray">{g.funder}</span>
                </div>
                <span className={`shrink-0 text-[12px] font-semibold ${overdue ? "text-red-600" : "text-warmgray"}`}>
                  {overdue ? "En retard · " : ""}{fmtDate(g.reporting_due_date)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </BlockShell>
  );
}
