import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAllOrganizations } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminOrganisationsPage() {
  const orgs = await getAllOrganizations();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Organisations</h1>
        <p className="mt-1 text-sm text-warmgray">
          {orgs.length} {orgs.length > 1 ? "lieux inscrits" : "lieu inscrit"} sur la plateforme.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        {/* En-tête de tableau */}
        <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.7fr_auto] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
          <span>Organisation</span>
          <span>Structure</span>
          <span>Membres</span>
          <span>Plan</span>
          <span>Créée</span>
        </div>

        {orgs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-warmgray">Aucune organisation pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orgs.map((o) => (
              <li
                key={o.id}
                className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[1.6fr_1fr_0.7fr_0.7fr_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <Link href={`/dashboard/${o.slug}`} className="group inline-flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink group-hover:text-coral-dark">{o.name}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-warmgray group-hover:text-coral-dark" />
                  </Link>
                  <div className="truncate text-[12px] text-warmgray">/{o.slug}{o.email ? ` · ${o.email}` : ""}</div>
                </div>
                <span className="text-[13px] text-ink">{o.structure ?? "—"}</span>
                <span className="text-[13px] text-ink">{o.memberCount}</span>
                <span>
                  <span className="rounded-full bg-peach-pale px-2.5 py-1 text-[11px] font-semibold uppercase text-coral-dark">{o.plan}</span>
                </span>
                <span className="text-[12px] text-warmgray">{fmtDate(o.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
