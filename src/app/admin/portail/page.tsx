import Link from "next/link";
import { ExternalLink, ListChecks, FileStack, Globe2, MessageSquareWarning } from "lucide-react";
import { getCatalogueStats } from "@/lib/admin/portail";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="font-heading text-3xl font-extrabold" style={{ color: color ?? "#2c2c2c" }}>{value}</div>
      <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-warmgray">{label}</div>
      {sub && <div className="mt-1 text-[12px] text-warmgray">{sub}</div>}
    </div>
  );
}

const RACCOURCIS = [
  { href: "/admin/portail/liste-blanche", label: "Liste blanche", desc: "Les lieux que l'import a le droit de moissonner", icon: ListChecks },
  { href: "/admin/portail/imports", label: "Imports", desc: "Ce qui est entré, quand, et depuis quels lieux", icon: FileStack },
  { href: "/admin/portail/pages", label: "Pages du portail", desc: "Rôle, indexation, présence au sitemap", icon: Globe2 },
  { href: "/admin/feedback", label: "Feedback et bugs", desc: "Les tickets remontés, tous lieux confondus", icon: MessageSquareWarning },
];

export default async function PortailPage() {
  const stats = await getCatalogueStats();

  if (!stats) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Portail public</h1>
        <p className="mt-3 rounded-2xl border border-border bg-white p-5 text-sm text-warmgray">
          La base n'a pas répondu. Aucun chiffre n'est affiché plutôt qu'un chiffre faux.
        </p>
      </div>
    );
  }

  const part = (n: number) => (stats.aVenir ? Math.round((n / stats.aVenir) * 100) : 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Portail public</h1>
        <p className="mt-1 text-sm text-warmgray">
          Ce que casaminga.com donne à voir aujourd'hui. Le portail lit cette base et n'y écrit
          jamais : tout ce qui le pilote se décide ici.{" "}
          <a href="https://casaminga.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-coral">
            Voir le site <ExternalLink className="size-3" />
          </a>
        </p>
      </header>

      <section className="mb-7">
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-warmgray">Le catalogue</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="À venir" value={stats.aVenir} sub={`sur ${stats.lieuxAVenir} lieux`} />
          <Kpi label="Du réseau" value={stats.duReseau} sub={`le reste est moissonné`} color={stats.duReseau === 0 ? "#b45309" : undefined} />
          <Kpi label="Validés" value={stats.valides} sub="aucune mise en avant sans validation" color={stats.valides === 0 ? "#b45309" : "#047857"} />
          <Kpi label="Passés" value={stats.passes} sub="hors index, page « terminé »" />
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-warmgray">Qualité des fiches à venir</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Avec photo" value={`${part(stats.avecImage)} %`} sub={`${stats.avecImage} fiches`} />
          <Kpi label="Gratuits" value={`${part(stats.gratuits)} %`} sub={`${stats.gratuits} fiches`} />
          <Kpi label="Type « autre »" value={`${part(stats.typeAutre)} %`} sub={`${stats.typeAutre} fiches hors filtre de format`} color={part(stats.typeAutre) > 30 ? "#b45309" : undefined} />
          <Kpi label="Lieux moissonnés" value={stats.lieuxImportes} sub={`${stats.lieuxAvecEmail} ont un email`} />
        </div>
      </section>

      <section className="mb-7 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-warmgray">Dernier import</h2>
        <p className="mt-2 text-sm text-ink">
          {stats.dernierImport ? (
            <>
              <span className="font-semibold">{fmtDate(stats.dernierImport)}</span>, {stats.importesDernierJour}{" "}
              {stats.importesDernierJour > 1 ? "fiches entrées ce jour-là" : "fiche entrée ce jour-là"}.
            </>
          ) : (
            "Aucun import enregistré."
          )}
        </p>
        <p className="mt-1 text-[12px] text-warmgray">
          L'import se lance en ligne de commande, depuis le dépôt :{" "}
          <code className="rounded bg-cream px-1.5 py-0.5 text-[11px]">
            python scripts/import-openagenda.py --lieux scripts/lieux-tiers-lieux.json --essai
          </code>
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-warmgray">Aller à</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {RACCOURCIS.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href} className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-colors hover:border-coral">
                <Icon className="mt-0.5 size-[18px] shrink-0 text-coral" strokeWidth={1.8} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{r.label}</span>
                  <span className="block text-[12px] text-warmgray">{r.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
