import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock, ExternalLink, Minus } from "lucide-react";
import { getEngagementStats, activityBucket, type OrgEngagementRow } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function fmtRelative(iso: string | null): string {
  if (!iso) return "jamais";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

const BUCKET_META = {
  active:  { label: "Active",     cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, dot: "bg-emerald-500" },
  recent:  { label: "Récente",    cls: "bg-blue-100 text-blue-700",       icon: Clock,        dot: "bg-blue-400" },
  dormant: { label: "Dormante",   cls: "bg-amber-100 text-amber-700",     icon: AlertTriangle, dot: "bg-amber-500" },
  never:   { label: "Jamais vue", cls: "bg-slate-100 text-slate-500",     icon: Minus,        dot: "bg-slate-300" },
};

const TIER_LABEL: Record<string, string> = {
  free: "Gratuit", complete: "Asso complète", multilieu: "Multi-lieux",
};

function KpiCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="font-heading text-3xl font-extrabold" style={{ color: color ?? "#2c2c2c" }}>{value}</div>
      <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-warmgray">{label}</div>
      {sub && <div className="mt-1 text-[12px] text-warmgray">{sub}</div>}
    </div>
  );
}

export default async function EngagementPage() {
  const orgs = await getEngagementStats();

  // KPIs
  const buckets = {
    active:  orgs.filter((o) => activityBucket(o.lastSeenAt) === "active"),
    recent:  orgs.filter((o) => activityBucket(o.lastSeenAt) === "recent"),
    dormant: orgs.filter((o) => activityBucket(o.lastSeenAt) === "dormant"),
    never:   orgs.filter((o) => activityBucket(o.lastSeenAt) === "never"),
  };
  const paying = orgs.filter((o) => o.tier !== "free" || o.founding_member || o.comped);

  // Adoption modules — quels modules sont le plus activés
  const moduleCount: Record<string, number> = {};
  for (const o of orgs) {
    for (const m of o.enabledModules) {
      moduleCount[m] = (moduleCount[m] ?? 0) + 1;
    }
  }
  const topModules = Object.entries(moduleCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Orgs dormantes à surveiller (tier complete ou fondateur)
  const atRisk = [...buckets.dormant, ...buckets.never]
    .filter((o) => o.tier !== "free" || o.founding_member || o.comped)
    .sort((a, b) => (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? ""));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-coral-dark" />
          <h1 className="font-heading text-2xl font-extrabold text-ink">Engagement</h1>
        </div>
        <p className="mt-1 text-sm text-warmgray">
          Activité réelle des {orgs.length} organisations — basée sur <code className="rounded bg-cream px-1 text-[11px]">last_seen_at</code> des membres.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Actives (7j)" value={buckets.active.length} color="#2f8a4c" sub="Au moins 1 membre connecté" />
        <KpiCard label="Récentes (30j)" value={buckets.recent.length} color="#0e6e7a" />
        <KpiCard label="Dormantes (30j+)" value={buckets.dormant.length} color="#c2410c" sub="Risque de churn" />
        <KpiCard label="Payantes / offertes" value={paying.length} color="#FF8A65" sub={`/ ${orgs.length} total`} />
      </div>

      {/* Alerte churn */}
      {atRisk.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <h2 className="font-heading text-[15px] font-bold text-amber-800">
              {atRisk.length} structure{atRisk.length > 1 ? "s" : ""} payante{atRisk.length > 1 ? "s" : ""} dormante{atRisk.length > 1 ? "s" : ""} — à rappeler
            </h2>
          </div>
          <ul className="space-y-2">
            {atRisk.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{o.name}</span>
                  <span className="ml-2 text-[12px] text-warmgray">/{o.slug}</span>
                </div>
                <span className="text-[12px] text-amber-700 font-medium">{fmtRelative(o.lastSeenAt)}</span>
                <Link href={`/dashboard/${o.slug}`} className="text-warmgray hover:text-coral-dark">
                  <ExternalLink className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Adoption des modules */}
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="mb-4 font-heading text-[15px] font-bold text-ink">Adoption des modules</h2>
        <div className="space-y-2">
          {topModules.map(([key, count]) => {
            const pct = Math.round((count / orgs.length) * 100);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[12px] font-semibold text-ink capitalize">{key}</span>
                <div className="flex-1 rounded-full bg-cream h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-coral-dark transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-20 text-right text-[12px] text-warmgray tabular-nums">{count}/{orgs.length} ({pct} %)</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-warmgray">
          Les modules avec &lt; 20 % d&apos;adoption sont des candidats à simplifier ou mieux mettre en avant.
        </p>
      </section>

      {/* Liste complète */}
      <section>
        <h2 className="mb-3 font-heading text-[15px] font-bold text-ink">Toutes les organisations</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.8fr_0.7fr] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Organisation</span>
            <span>Dernière activité</span>
            <span>Membres</span>
            <span>Abonnement</span>
            <span>Inscription</span>
          </div>
          <ul className="divide-y divide-border">
            {orgs.map((o) => {
              const bucket = activityBucket(o.lastSeenAt);
              const bm = BUCKET_META[bucket];
              const BIcon = bm.icon;
              return (
                <li key={o.id} className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[1.6fr_1fr_0.7fr_0.8fr_0.7fr] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <Link href={`/dashboard/${o.slug}`} className="group inline-flex items-center gap-1.5">
                      <span className="font-semibold text-ink group-hover:text-coral-dark">{o.name}</span>
                      <ExternalLink className="size-3 text-warmgray group-hover:text-coral-dark" />
                    </Link>
                    <div className="text-[11px] text-warmgray">/{o.slug}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bm.cls}`}>
                      <BIcon className="size-3" />
                      {bm.label}
                    </span>
                    <span className="text-[11px] text-warmgray">{fmtRelative(o.lastSeenAt)}</span>
                  </div>
                  <span className="text-[13px] text-ink">{o.memberCount}</span>
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      o.founding_member ? "bg-amber-100 text-amber-700" :
                      o.comped ? "bg-emerald-100 text-emerald-700" :
                      o.tier === "complete" ? "bg-coral/10 text-coral-dark" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {o.founding_member ? "⭐ Fondateur" : o.comped ? "🎁 Offert" : TIER_LABEL[o.tier] ?? o.tier}
                    </span>
                  </div>
                  <span className="text-[12px] text-warmgray">{fmtDate(o.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
