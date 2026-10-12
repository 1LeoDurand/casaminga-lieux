import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  getRetraits, chercherCibles, getCible, PORTEES, CANAUX,
  type RetraitLigne, type CibleRetrait,
} from "@/lib/admin/retraits";
import { PoserRetraitForm, LeverRetraitForm } from "@/components/admin/retraits-forms";

export const dynamic = "force-dynamic";

type Params = { q?: string; org?: string; lieu?: string; thread?: string };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const libellePortee = (p: string) => PORTEES.find((x) => x.value === p)?.label ?? p;
const libelleCanal = (c: string) => CANAUX.find((x) => x.value === c)?.label ?? c;

function Ligne({ r, actif }: { r: RetraitLigne; actif: boolean }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{r.cible}</div>
          <div className="text-[12px] text-warmgray">
            {libellePortee(r.portee)}
            {r.source ? ` (source : ${r.source})` : r.portee === "import" ? " (toutes les sources)" : ""}
            {" · "}{r.fiches} fiche{r.fiches > 1 ? "s" : ""}
          </div>
          <div className="mt-1 text-[12px] text-warmgray">
            Demande du {fmtDate(r.demandeLe)} ({libelleCanal(r.canal).toLowerCase()}), posée le {fmtDate(r.poseLe)} par {r.posePar}.
          </div>
          <div className="mt-1 text-[12.5px] text-ink">{r.motif}</div>
          {!actif && r.leveLe && (
            <div className="mt-1 text-[12px] text-warmgray">
              Levé le {fmtDate(r.leveLe)} par {r.levePar}{r.leveMotif ? `, motif : ${r.leveMotif}` : ""}.
            </div>
          )}
        </div>
        {actif && <LeverRetraitForm retraitId={r.id} />}
      </div>
    </li>
  );
}

function ResultatCible({ c, q, thread }: { c: CibleRetrait; q: string; thread?: string }) {
  const params = new URLSearchParams({ q });
  params.set(c.type === "organisation" ? "org" : "lieu", c.id);
  if (thread) params.set("thread", thread);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{c.nom}</div>
        <div className="text-[12px] text-warmgray">
          {c.detail}
          {c.type === "organisation" && ` · ${c.fichesTotal} fiches, ${c.fichesAvenir} à venir, ${c.fichesAvecMedias} avec médias`}
        </div>
      </div>
      <Link href={`/admin/portail/retraits?${params.toString()}`} className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:border-coral">
        Choisir
      </Link>
    </li>
  );
}

export default async function RetraitsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);

  const [retraits, resultats, cible] = await Promise.all([
    getRetraits(),
    q ? chercherCibles(q) : Promise.resolve([] as CibleRetrait[]),
    sp.org ? getCible("organisation", sp.org) : sp.lieu ? getCible("lieu", sp.lieu) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/portail" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-warmgray hover:text-ink">
        <ArrowLeft className="size-3.5" /> Portail public
      </Link>

      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Retraits sur demande</h1>
        <p className="mt-1 text-sm text-warmgray">
          Une organisation ou un lieu demande que ses médias, ses fiches ou son import disparaissent : un
          geste ici, réversible, respecté par les imports suivants. Rien n&apos;est supprimé.
        </p>
      </header>

      <section className="mb-7 rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-heading text-base font-bold text-ink">Poser un retrait</h2>
        </div>

        {cible ? (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-border bg-cream p-4">
              <div className="text-sm font-semibold text-ink">{cible.nom}</div>
              <div className="text-[12px] text-warmgray">
                {cible.detail}
                {cible.type === "organisation" && ` · ${cible.fichesTotal} fiches, ${cible.fichesAvenir} à venir, ${cible.fichesAvecMedias} avec médias`}
                {cible.sources.length > 0 && ` · sources : ${cible.sources.join(", ")}`}
              </div>
              <Link href={`/admin/portail/retraits${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="mt-2 inline-block text-[12px] font-semibold text-coral-dark hover:underline">
                Changer de cible
              </Link>
            </div>
            {cible.retirable ? (
              <PoserRetraitForm type={cible.type} id={cible.id} sources={cible.sources} threadId={sp.thread} />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">{cible.raison}</p>
            )}
          </div>
        ) : (
          <div className="px-5 py-5">
            <form method="get" className="flex gap-2">
              {sp.thread && <input type="hidden" name="thread" value={sp.thread} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Nom de l'organisation importée ou du lieu"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-coral"
              />
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white hover:bg-coral-dark">
                <Search className="size-3.5" /> Chercher
              </button>
            </form>
            <p className="mt-2 text-[12px] text-warmgray">
              Seules les organisations importées et non revendiquées sont proposées, avec les lieux de l&apos;annuaire.
            </p>
          </div>
        )}

        {!cible && q && (
          resultats.length === 0 ? (
            <p className="border-t border-border px-5 py-6 text-center text-sm text-warmgray">Aucun résultat pour « {q} ».</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {resultats.map((c) => <ResultatCible key={`${c.type}-${c.id}`} c={c} q={q} thread={sp.thread} />)}
            </ul>
          )
        )}
      </section>

      {!retraits ? (
        <p className="rounded-2xl border border-border bg-white p-5 text-sm text-warmgray">
          Le journal n&apos;a pas pu être lu (base injoignable ou migration non appliquée).
        </p>
      ) : (
        <>
          <section className="mb-7 rounded-2xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-heading text-base font-bold text-ink">Retraits actifs</h2>
              <span className="rounded-full bg-peach-pale px-2.5 py-1 text-[11px] font-semibold text-coral-dark">{retraits.actifs.length}</span>
            </div>
            {retraits.actifs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-warmgray">Aucun retrait actif.</p>
            ) : (
              <ul className="divide-y divide-border">{retraits.actifs.map((r) => <Ligne key={r.id} r={r} actif />)}</ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-heading text-base font-bold text-ink">Journal des retraits levés</h2>
              <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-warmgray">{retraits.leves.length}</span>
            </div>
            {retraits.leves.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-warmgray">Aucun retrait levé pour le moment.</p>
            ) : (
              <ul className="divide-y divide-border">{retraits.leves.map((r) => <Ligne key={r.id} r={r} actif={false} />)}</ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
