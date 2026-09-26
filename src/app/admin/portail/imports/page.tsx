import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHistoriqueImports } from "@/lib/admin/portail";

export const dynamic = "force-dynamic";

function fmtJour(jour: string): string {
  return new Date(jour + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default async function ImportsPage() {
  const jours = await getHistoriqueImports();
  const total = jours.reduce((n, j) => n + j.evenements, 0);
  const maximum = Math.max(1, ...jours.map((j) => j.evenements));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/portail" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-warmgray hover:text-ink">
        <ArrowLeft className="size-3.5" /> Portail public
      </Link>

      <header className="mb-5">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Imports</h1>
        <p className="mt-1 text-sm text-warmgray">
          Ce qui est entré dans le catalogue, jour par jour, reconstitué depuis la table de
          provenance. {total} fiches sur les {jours.length} jours d'import listés.
        </p>
      </header>

      {jours.length === 0 ? (
        <p className="rounded-2xl border border-border bg-white p-5 text-sm text-warmgray">
          Aucun import enregistré.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          {jours.map((j) => (
            <div key={j.jour} className="border-b border-border/60 px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-semibold text-ink first-letter:uppercase">{fmtJour(j.jour)}</span>
                <span className="text-[12px] text-warmgray">
                  {j.evenements} {j.evenements > 1 ? "fiches" : "fiche"} · {j.lieux}{" "}
                  {j.lieux > 1 ? "lieux" : "lieu"} · de {fmtHeure(j.premier)} à {fmtHeure(j.dernier)}
                </span>
              </div>
              {/* Barre proportionnelle au plus gros jour : un import se fait par
                  vagues, et l'ampleur de chacune se lit mieux qu'un nombre seul. */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full rounded-full bg-coral"
                  style={{ width: `${Math.round((j.evenements / maximum) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] text-warmgray">
        Les fiches réimportées ne sont pas comptées deux fois : l'import reconnaît ce qui existe
        déjà et ne réécrit jamais une fiche corrigée à la main.
      </p>
    </div>
  );
}
