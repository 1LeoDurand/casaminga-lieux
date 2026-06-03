import Link from "next/link";
import { Building2, Users, MessageSquareWarning, TrendingUp, ArrowUpRight } from "lucide-react";
import { getPlatformStats } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();

  const kpis = [
    { label: "Organisations", value: stats.orgs, icon: Building2, color: "#FF8A65", bg: "#FFF0EB" },
    { label: "Utilisateurs", value: stats.members, icon: Users, color: "#2f8a4c", bg: "#E8F3E9" },
    { label: "Inscriptions (30j)", value: stats.signups30d, icon: TrendingUp, color: "#0e6e7a", bg: "#E6F4F7" },
    { label: "Tickets ouverts", value: stats.feedbackOpen, icon: MessageSquareWarning, color: "#c2410c", bg: "#FFF7ED" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Vue d'ensemble</h1>
        <p className="mt-1 text-sm text-warmgray">Pilotage global de la plateforme Casa Minga Lieux.</p>
      </header>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-border bg-white p-5">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl" style={{ background: k.bg, color: k.color }}>
                <Icon className="size-5" strokeWidth={1.9} />
              </div>
              <div className="font-heading text-3xl font-extrabold text-ink">{k.value}</div>
              <div className="mt-0.5 text-[12px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Dernières organisations */}
      <section className="rounded-2xl border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-base font-bold text-ink">Dernières organisations</h2>
          <Link href="/admin/organisations" className="inline-flex items-center gap-1 text-[13px] font-semibold text-coral-dark hover:underline">
            Tout voir <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        {stats.recentOrgs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-warmgray">Aucune organisation pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentOrgs.map((o) => (
              <li key={o.slug} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{o.name}</div>
                  <div className="truncate text-[12px] text-warmgray">/{o.slug} · créée le {fmtDate(o.created_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-peach-pale px-2.5 py-1 text-[11px] font-semibold uppercase text-coral-dark">{o.plan}</span>
                  <Link href={`/dashboard/${o.slug}`} className="text-[12px] font-semibold text-coral-dark hover:underline">
                    Ouvrir →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
