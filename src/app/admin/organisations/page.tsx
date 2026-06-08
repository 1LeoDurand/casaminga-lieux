import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAllOrganizations, getAllSubscriptions } from "@/lib/admin/data";
import { OrgTierSelector } from "@/components/admin/org-tier-selector";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const TIER_BADGE: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  complete: "bg-coral/10 text-coral-dark",
  multilieu: "bg-emerald-100 text-emerald-700",
};
const TIER_LABEL: Record<string, string> = {
  free: "Gratuit",
  complete: "Asso complète",
  multilieu: "Multi-lieux",
};

export default async function AdminOrganisationsPage() {
  const [orgs, subs] = await Promise.all([getAllOrganizations(), getAllSubscriptions()]);
  const subByOrg = new Map(subs.map((s) => [s.organization_id, s]));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Organisations</h1>
        <p className="mt-1 text-sm text-warmgray">
          {orgs.length} {orgs.length > 1 ? "lieux inscrits" : "lieu inscrit"} sur la plateforme.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.5fr_1.2fr_auto] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
          <span>Organisation</span>
          <span>Structure</span>
          <span>Membres</span>
          <span>Abonnement</span>
          <span>Créée</span>
        </div>

        {orgs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-warmgray">Aucune organisation pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orgs.map((o) => {
              const sub = subByOrg.get(o.id);
              const tier = sub?.tier ?? "free";
              const isFounder = sub?.founding_member ?? false;
              const isComped = sub?.comped ?? false;
              return (
                <li
                  key={o.id}
                  className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[1.4fr_0.8fr_0.5fr_1.2fr_auto] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <Link href={`/dashboard/${o.slug}`} className="group inline-flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink group-hover:text-coral-dark">{o.name}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-warmgray group-hover:text-coral-dark" />
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[12px] text-warmgray">/{o.slug}</span>
                      {isFounder && <span className="rounded-full bg-amber-100 px-2 py-px text-[10px] font-bold text-amber-700">⭐ Fondateur</span>}
                      {isComped && !isFounder && <span className="rounded-full bg-emerald-100 px-2 py-px text-[10px] font-bold text-emerald-700">🎁 Offert</span>}
                    </div>
                  </div>
                  <span className="text-[13px] text-ink">{o.structure ?? "—"}</span>
                  <span className="text-[13px] text-ink">{o.memberCount}</span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_BADGE[tier] ?? TIER_BADGE.free}`}>
                      {TIER_LABEL[tier] ?? tier}
                    </span>
                    <OrgTierSelector orgId={o.id} currentTier={tier as "free" | "complete" | "multilieu"} currentFounder={isFounder} currentComped={isComped} />
                  </div>
                  <span className="text-[12px] text-warmgray">{fmtDate(o.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
