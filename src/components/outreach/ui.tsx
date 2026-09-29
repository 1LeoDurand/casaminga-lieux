import Link from "next/link";
import type { ReactNode } from "react";
import type { NeedsLeoReason, ProgramConfig, StageRole } from "@/lib/outreach/types";
import { NEEDS_LEO_LABELS } from "@/lib/outreach/types";

/** Presentation helpers of the contacts module. No data access, safe for server and client. */

const TZ = "Europe/Paris";
const dtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });

/** An external URL from imported data, kept only if it is http(s); null otherwise (no javascript:, data:…). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtFmt.format(d);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dFmt.format(d);
}

/** "il y a 3 j" style age, calculated from a fixed `now` given by the caller. */
export function ageLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "moins d'une heure";
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toLocaleString("fr-FR");
}

const ROLE_BADGE: Record<StageRole, string> = {
  a_valider: "mc-badge-orange",
  planifie: "mc-badge-blue",
  attente: "mc-badge-gray",
  relance: "mc-badge-gray",
  nouveau: "mc-badge-orange",
  conversation: "mc-badge-purple",
  resolu: "mc-badge-green",
  succes: "mc-badge-green",
  clos: "mc-badge-gray",
};

export function StageBadge({ label, role }: { label: string; role: StageRole | null }) {
  return <span className={`mc-badge ${role ? ROLE_BADGE[role] : "mc-badge-gray"}`}>{label}</span>;
}

export function ReasonBadge({ reason }: { reason: NeedsLeoReason | null }) {
  if (!reason) return null;
  return <span className="mc-badge mc-badge-red">{NEEDS_LEO_LABELS[reason] ?? reason}</span>;
}

export function ToiBadge() {
  return <span className="mc-badge mc-badge-red">À toi</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "ok" }) {
  return (
    <div className="mc-stat">
      <div className="mc-stat-val" style={tone === "danger" ? { color: "#c0392b" } : tone === "ok" ? { color: "#2d8a4e" } : undefined}>{value}</div>
      <div className="mc-stat-lbl">{label}</div>
      {sub ? <div className="mc-stat-chg">{sub}</div> : null}
    </div>
  );
}

export function Section({ title, hint, children, id, action }: {
  title: string; hint?: ReactNode; children: ReactNode; id?: string; action?: ReactNode;
}) {
  return (
    <section id={id} className="mc-card p-[18px]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-[15px] font-bold text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] text-warmgray">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-warmgray">{children}</p>;
}

export function ThreadLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link href={`/admin/contacts/fils/${id}`} className="font-semibold text-ink underline-offset-2 hover:text-coral-dark hover:underline">
      {children}
    </Link>
  );
}

/** Keeps ?programme= when a link moves inside the module. */
export function withProgram(path: string, slug: string | null | undefined, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (slug) params.set("programme", slug);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Program chips: "Tous" or one program, kept in the URL (?programme=). */
export function ProgramSelector({ programs, current, basePath, extra = {}, allowAll = true }: {
  programs: Pick<ProgramConfig, "slug" | "label" | "active">[];
  current: string | null;
  basePath: string;
  extra?: Record<string, string | undefined>;
  allowAll?: boolean;
}) {
  return (
    <div className="mc-chips" role="tablist" aria-label="Programme">
      {allowAll ? (
        <Link href={withProgram(basePath, null, extra)} className={`mc-chip ${current === null ? "active" : ""}`}>Tous</Link>
      ) : null}
      {programs.map((p) => (
        <Link key={p.slug} href={withProgram(basePath, p.slug, extra)} className={`mc-chip ${current === p.slug ? "active" : ""}`}>
          {p.label}
          {!p.active ? <span className="opacity-70"> · inactif</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, hrefFor }: {
  page: number; pages: number; total: number; hrefFor: (page: number) => string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-warmgray">
      <span>{total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""} · page {page} sur {pages}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link className="mc-btn mc-btn-outline mc-btn-sm" href={hrefFor(page - 1)}>Précédente</Link> : null}
        {page < pages ? <Link className="mc-btn mc-btn-outline mc-btn-sm" href={hrefFor(page + 1)}>Suivante</Link> : null}
      </span>
    </div>
  );
}
