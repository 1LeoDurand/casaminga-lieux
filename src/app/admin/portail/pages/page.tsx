import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPagesPortail } from "@/lib/admin/portail";

export const dynamic = "force-dynamic";

const INDEXATION = {
  indexee: { label: "Indexée", cls: "bg-emerald-100 text-emerald-700" },
  noindex: { label: "Hors index", cls: "bg-slate-100 text-slate-600" },
  conditionnelle: { label: "Selon filtres", cls: "bg-amber-100 text-amber-700" },
};

export default async function PagesPortailPage() {
  const pages = await getPagesPortail();
  const enPanne = pages.filter((p) => p.code !== null && p.code >= 400);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/portail" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-warmgray hover:text-ink">
        <ArrowLeft className="size-3.5" /> Portail public
      </Link>

      <header className="mb-5">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Pages du portail</h1>
        <p className="mt-1 text-sm text-warmgray">
          Les adresses servies par casaminga.com, leur rôle et leur règle d'indexation. Les codes
          sont relevés à l'instant, en direct.
        </p>
      </header>

      <div className="mb-5 rounded-2xl border border-border bg-cream p-4 text-[12.5px] leading-relaxed text-warmgray">
        Le code HTTP dit peu de chose ici : une application monopage renvoie le même fichier pour
        toutes les adresses, donc presque tout répond 200, y compris une adresse qui n'existe pas.
        Ce qui renseigne vraiment, c'est la colonne sitemap, et la règle d'indexation.
        {enPanne.length > 0 && (
          <span className="mt-2 block font-semibold text-amber-900">
            {enPanne.length} {enPanne.length > 1 ? "adresses répondent" : "adresse répond"} par une
            erreur : à regarder en premier.
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-border bg-cream/60 text-[11px] uppercase tracking-wide text-warmgray">
            <tr>
              <th className="px-4 py-3 font-semibold">Adresse</th>
              <th className="px-4 py-3 font-semibold">Rôle</th>
              <th className="px-4 py-3 font-semibold">Indexation</th>
              <th className="px-4 py-3 text-center font-semibold">Sitemap</th>
              <th className="px-4 py-3 text-center font-semibold">Code</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const meta = INDEXATION[p.indexation];
              const dynamique = p.chemin.includes(":");
              return (
                <tr key={p.chemin} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    {dynamique ? (
                      <span className="font-mono text-[12px] text-ink">{p.chemin}</span>
                    ) : (
                      <a
                        href={`https://casaminga.com${p.chemin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[12px] text-ink hover:text-coral"
                      >
                        {p.chemin} <ExternalLink className="size-3 shrink-0 opacity-50" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-warmgray">
                    {p.role}
                    {p.note && <span className="block text-[11px] italic">{p.note}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-warmgray">
                    {dynamique ? "—" : p.dansSitemap ? "oui" : "non"}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {p.code === null ? (
                      <span className="text-warmgray">—</span>
                    ) : (
                      <span className={p.code >= 400 ? "font-semibold text-red-600" : "text-warmgray"}>
                        {p.code}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-warmgray">
        Les fiches de rendez-vous et les vitrines de lieu ne sont pas au sitemap : leur nombre
        change en continu, un fichier statique serait périmé dès le prochain import.
      </p>
    </div>
  );
}
