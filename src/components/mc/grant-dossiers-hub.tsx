import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { APPLICATION_STATUS_META, type ApplicationStatus } from "@/lib/grants/types";
import type { FollowedDossier } from "@/lib/grants/data";

/** Logical pipeline order for followed dossiers (from first interest to outcome). */
const STATUS_ORDER: ApplicationStatus[] = ["interesse", "en_cours", "depose", "obtenu", "refuse"];

/** Days between now and an ISO date (negative = past). */
function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/**
 * Hub showing all grant applications currently being tracked (watch-list
 * dossiers), above the signed conventions list on the Subventions page.
 * Renders nothing when the org has no followed dossier.
 */
export function GrantDossiersHub({ dossiers, orgSlug }: { dossiers: FollowedDossier[]; orgSlug: string }) {
  if (dossiers.length === 0) return null;

  // Pipeline counters: only statuses actually present, in logical order.
  const counts = new Map<ApplicationStatus, number>();
  for (const { application } of dossiers) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  }
  const presentStatuses = STATUS_ORDER.filter((s) => counts.has(s));

  // Sort by status order, then by upcoming deadline (nulls last).
  const sorted = [...dossiers].sort((a, b) => {
    const orderDiff = STATUS_ORDER.indexOf(a.application.status) - STATUS_ORDER.indexOf(b.application.status);
    if (orderDiff !== 0) return orderDiff;
    const dA = a.opportunity?.deadline ?? null;
    const dB = b.opportunity?.deadline ?? null;
    if (dA && dB) return new Date(dA).getTime() - new Date(dB).getTime();
    if (dA) return -1;
    if (dB) return 1;
    return 0;
  });

  return (
    <section className="rounded-2xl border border-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-[15px] font-bold text-ink">Dossiers en cours</h2>
          <p className="text-[13px] text-warmgray">Vos candidatures issues de la veille.</p>
        </div>
        <Link
          href={`/dashboard/${orgSlug}/subventions/veille`}
          className="text-[13px] font-semibold text-coral-dark hover:underline"
        >
          Trouver des financements →
        </Link>
      </div>

      {/* Pipeline counters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {presentStatuses.map((s) => {
          const meta = APPLICATION_STATUS_META[s];
          return (
            <span
              key={s}
              className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${meta.color}`}
            >
              {meta.icon} {meta.label} · {counts.get(s)}
            </span>
          );
        })}
      </div>

      {/* Dossiers list */}
      <div className="mt-4 flex flex-col gap-2">
        {sorted.map(({ application, opportunity }) => {
          const meta = APPLICATION_STATUS_META[application.status];

          if (!opportunity) {
            // Underlying opportunity was removed from the catalogue.
            return (
              <div
                key={application.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-[#FAFAF7] px-4 py-3 opacity-70"
              >
                <div className="min-w-0 flex-1">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <div className="mt-1 text-[13.5px] italic text-warmgray">Opportunité archivée</div>
                </div>
              </div>
            );
          }

          const deadline = opportunity.deadline;
          const days = deadline ? daysUntil(deadline) : null;
          const isSoon = days !== null && days >= 0 && days <= 30;

          return (
            <div
              key={application.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[#FAFAF7] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
                <div className="mt-1 truncate font-semibold text-[13.5px] text-ink">{opportunity.title}</div>
                {opportunity.funder && (
                  <div className="truncate text-[12px] text-warmgray">{opportunity.funder}</div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {deadline && (
                  <div className="inline-flex items-center gap-1 text-[12px] text-warmgray">
                    <CalendarClock className="size-3.5" />
                    {new Date(deadline).toLocaleDateString("fr-FR")}
                    {isSoon && <span className="font-semibold text-coral-dark">· J-{days}</span>}
                  </div>
                )}
                <Link
                  href={`/dashboard/${orgSlug}/subventions/veille/${opportunity.id}`}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-semibold hover:border-coral/40"
                >
                  Préparer
                </Link>
                {application.linked_grant_id && (
                  <Link
                    href={`/dashboard/${orgSlug}/subventions`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Convention ✓
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
