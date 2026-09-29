import Link from "next/link";
import { Building2, Globe2, Link2, MapPin } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { listContacts } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import { ADDRESS_SOURCE_LABELS } from "@/lib/outreach/types";
import { EmptyLine, Pagination, ProgramSelector, ToiBadge, fmtDate } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type SP = { programme?: string; q?: string; etape?: string; article?: string; region?: string; photos?: string; toi?: string; page?: string };
type PageProps = { searchParams: Promise<SP> };

const BASE = "/admin/contacts/lieux";

function href(sp: SP, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "page") params.set(k, v);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

export default async function ContactsListPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const programs = await getProgramConfigs();
  const program = programs.find((p) => p.slug === sp.programme) ?? null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listContacts({
    q: sp.q, programme: program?.slug, etape: sp.etape || undefined, article: sp.article || undefined,
    region: sp.region || undefined, photos: sp.photos === "1", aToi: sp.toi === "1", page,
  });

  // Stage choices: the program's own stages, or every distinct stage across programs.
  const stageOptions = new Map<string, string>();
  for (const p of program ? [program] : programs) for (const s of p.stages) if (!stageOptions.has(s.slug)) stageOptions.set(s.slug, s.label);

  const filtered = !!(sp.q || sp.programme || sp.etape || sp.article || sp.region || sp.photos || sp.toi);

  return (
    <div className="flex flex-col gap-5">
      <ProgramSelector programs={programs} current={program?.slug ?? null} basePath={BASE} />

      <form method="get" action={BASE} className="mc-card flex flex-wrap items-end gap-3 p-[14px]">
        {program ? <input type="hidden" name="programme" value={program.slug} /> : null}
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Recherche</span>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Nom ou ville" className="mc-input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Étape</span>
          <select name="etape" defaultValue={sp.etape ?? ""} className="mc-input">
            <option value="">Toutes</option>
            {[...stageOptions.entries()].map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Article</span>
          <select name="article" defaultValue={sp.article ?? ""} className="mc-input max-w-[220px]">
            <option value="">Tous</option>
            {result.articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase text-warmgray">Région</span>
          <select name="region" defaultValue={sp.region ?? ""} className="mc-input">
            <option value="">Toutes</option>
            {result.regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-[13px]">
          <input type="checkbox" name="photos" value="1" defaultChecked={sp.photos === "1"} /> Photos accordées
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-[13px]">
          <input type="checkbox" name="toi" value="1" defaultChecked={sp.toi === "1"} /> À toi
        </label>
        <button type="submit" className="mc-btn mc-btn-lime mc-btn-sm">Filtrer</button>
        {filtered ? <Link className="mc-btn mc-btn-outline mc-btn-sm" href={BASE}>Réinitialiser</Link> : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyLine>
          {filtered
            ? "Aucun lieu ne correspond à ces filtres."
            : "Aucun lieu pour le moment. Les fiches apparaissent quand la skill dépose des brouillons ou quand un mail arrive."}
        </EmptyLine>
      ) : (
        <div className="mc-card overflow-hidden">
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Lieu</th><th>Adresse principale</th><th>Fils</th><th>Dernier échange</th><th>Rattachements</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/contacts/lieux/${r.id}`} className="font-semibold text-ink hover:text-coral-dark">{r.name}</Link>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-warmgray">
                        <MapPin className="size-3" /> {[r.city, r.region].filter(Boolean).join(", ") || "Lieu non renseigné"}
                        {r.kind ? <span className="ml-1">· {r.kind.replace(/_/g, " ")}</span> : null}
                      </div>
                      {r.do_not_contact ? <span className="mt-1 inline-block mc-badge mc-badge-red">Ne plus écrire</span> : null}
                    </td>
                    <td>
                      {r.primaryAddress ? (
                        <>
                          <div className="text-[13px]">{r.primaryAddress.email}</div>
                          <div className="text-[11px] text-warmgray">
                            {ADDRESS_SOURCE_LABELS[r.primaryAddress.source] ?? r.primaryAddress.source}
                            {r.primaryAddress.status !== "valide" ? ` · ${r.primaryAddress.status.replace(/_/g, " ")}` : ""}
                          </div>
                        </>
                      ) : <span className="text-warmgray">Aucune adresse</span>}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {r.threads.length === 0 ? <span className="text-warmgray">À contacter</span> : null}
                        {r.threads.map((t) => (
                          <Link key={t.id} href={`/admin/contacts/fils/${t.id}`} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                            <span className="text-warmgray">{t.program_label} ·</span>
                            <span className="font-medium text-ink">{t.stage_label}</span>
                            {t.needs_leo ? <ToiBadge /> : null}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-warmgray">{fmtDate(r.lastExchange)}</td>
                    <td>
                      <span className="flex items-center gap-2 text-warmgray">
                        {r.links.organization ? <span title="Organisation de l'admin"><Building2 className="size-4" /></span> : null}
                        {r.links.establishment ? <span title="Établissement"><Building2 className="size-4 opacity-60" /></span> : null}
                        {r.links.annuaire ? <span title="Annuaire des lieux"><Link2 className="size-4" /></span> : null}
                        {r.links.sejour ? <span title="Fiche sejour.casaminga.com"><Globe2 className="size-4" /></span> : null}
                        {!Object.values(r.links).some(Boolean) ? "—" : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={result.page} pages={result.pages} total={result.total} hrefFor={(p) => href(sp, p)} />
    </div>
  );
}
