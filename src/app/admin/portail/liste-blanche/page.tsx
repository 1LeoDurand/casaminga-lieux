import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react";
import { getListeBlanche } from "@/lib/admin/portail";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default async function ListeBlanchePage() {
  const liste = await getListeBlanche();

  if (!liste) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Liste blanche</h1>
        <p className="mt-3 rounded-2xl border border-border bg-white p-5 text-sm text-warmgray">
          Le fichier <code>scripts/lieux-tiers-lieux.json</code> est introuvable sur ce serveur.
          Il fait partie du dépôt : un déploiement incomplet en est la cause la plus probable.
        </p>
      </div>
    );
  }

  // Un lieu réel peut porter plusieurs identifiants OpenAgenda : on affiche le
  // lieu, pas l'identifiant, et on dit combien d'identifiants le désignent.
  const parCanonique = new Map<string, typeof liste.lieux>();
  for (const l of liste.lieux) {
    parCanonique.set(l.canonique, [...(parCanonique.get(l.canonique) ?? []), l]);
  }
  const lieux = [...parCanonique.values()]
    .map((membres) => {
      const principal = membres[0];
      return {
        ...principal,
        identifiants: membres.length,
        evenements: membres.reduce((n, m) => Math.max(n, m.evenements), 0),
        aVenir: membres.reduce((n, m) => Math.max(n, m.aVenir), 0),
        dernierImport: membres.map((m) => m.dernierImport).filter(Boolean).sort().pop() ?? null,
      };
    })
    .sort((a, b) => b.aVenir - a.aVenir || a.nom.localeCompare(b.nom, "fr"));

  const jamaisVus = lieux.filter((l) => !l.organisationId).length;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/portail" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-warmgray hover:text-ink">
        <ArrowLeft className="size-3.5" /> Portail public
      </Link>

      <header className="mb-5">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Liste blanche</h1>
        <p className="mt-1 text-sm text-warmgray">
          Les seuls lieux dont l'import a le droit de reprendre les rendez-vous.{" "}
          <span className="font-semibold text-ink">{liste.lieuxReels} lieux</span> pour{" "}
          {liste.identifiants} identifiants OpenAgenda.
        </p>
      </header>

      <div className="mb-5 rounded-2xl border border-border bg-cream p-4 text-[12.5px] leading-relaxed text-warmgray">
        {liste.note}
      </div>

      {jamaisVus > 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
          {jamaisVus} {jamaisVus > 1 ? "lieux n'ont" : "lieu n'a"} encore aucune fiche en base : le lieu
          est retenu, mais il n'a rien publié depuis son entrée dans la liste.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-border bg-cream/60 text-[11px] uppercase tracking-wide text-warmgray">
            <tr>
              <th className="px-4 py-3 font-semibold">Lieu</th>
              <th className="px-4 py-3 font-semibold">Ville</th>
              <th className="px-4 py-3 font-semibold">Au recensement</th>
              <th className="px-4 py-3 text-right font-semibold">Fiches</th>
              <th className="px-4 py-3 text-right font-semibold">À venir</th>
              <th className="px-4 py-3 font-semibold">Dernier import</th>
            </tr>
          </thead>
          <tbody>
            {lieux.map((l) => (
              <tr key={l.canonique} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {l.organisationId ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleDashed className="size-3.5 shrink-0 text-warmgray/60" />
                    )}
                    <span className="font-medium text-ink">{l.nom}</span>
                  </div>
                  <div className="ml-[22px] text-[11px] text-warmgray">
                    {l.methode}
                    {l.identifiants > 1 && ` · ${l.identifiants} identifiants`}
                    {l.revendique && " · revendiqué"}
                  </div>
                </td>
                <td className="px-4 py-3 text-warmgray">{l.ville || "non renseignée"}</td>
                <td className="px-4 py-3 text-warmgray">{l.recense}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.evenements || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink">{l.aVenir || "—"}</td>
                <td className="px-4 py-3 text-warmgray">{fmtDate(l.dernierImport)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-warmgray">
        Cette page lit le fichier <code>scripts/lieux-tiers-lieux.json</code> du dépôt, elle ne le
        modifie pas. L'élargir demande de relancer l'appariement avec les recensements, puis de
        relire les nouveaux lieux un par un : c'est cette relecture qui tient la liste propre.
      </p>
    </div>
  );
}
