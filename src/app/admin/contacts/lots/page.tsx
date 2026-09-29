import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { LOT_SIZE, getLotData } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import { LotView } from "@/components/outreach/lot-view";
import { EmptyLine, ProgramSelector, Section } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ programme?: string; lot?: string }> };

export default async function LotsPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const programs = await getProgramConfigs();
  const outbound = programs.filter((p) => p.direction === "sortant");
  const program = outbound.find((p) => p.slug === sp.programme) ?? null;
  const lot = await getLotData(program?.slug ?? null, sp.lot ?? null);

  return (
    <div className="flex flex-col gap-5">
      <ProgramSelector programs={outbound} current={program?.slug ?? null} basePath="/admin/contacts/lots" />

      <p className="text-[13px] text-warmgray">
        Un lot réunit {LOT_SIZE} brouillons au plus, du même programme, du même gabarit et du même article. Les brouillons personnalisés se valident un par un, depuis la fiche du lieu.
      </p>

      {lot.groups.length === 0 ? (
        <EmptyLine>
          Aucun brouillon à valider par lot.
          {lot.customCount > 0 ? ` ${lot.customCount} brouillon(s) personnalisé(s) attendent sur les fiches des lieux.` : ""}
        </EmptyLine>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {lot.groups.map((g) => (
              <Link
                key={g.key}
                href={`/admin/contacts/lots?${new URLSearchParams({ ...(program ? { programme: program.slug } : {}), lot: g.key }).toString()}`}
                className={`mc-chip ${lot.selected?.key === g.key ? "active" : ""}`}
              >
                {g.program_label} · {g.article_title ?? "sans article"} · {g.count}
              </Link>
            ))}
          </div>

          {lot.selected ? (
            <Section
              title={`${lot.selected.article_title ?? "Sans article"} · ${lot.selected.program_label}`}
              hint={`${lot.selected.count} brouillon(s) dans ce groupe${lot.selected.count > LOT_SIZE ? `, ${LOT_SIZE} affichés (les plus anciens)` : ""}. Gabarit : ${lot.selected.template_id ?? "non renseigné"}.`}
            >
              {/* key: a new group remounts the view and resets the checkboxes */}
              <LotView key={lot.selected.key} items={lot.items} templateText={lot.templateText} subject={lot.items[0]?.subject ?? null} />
            </Section>
          ) : null}
          {lot.customCount > 0 ? (
            <p className="text-[12px] text-warmgray">{lot.customCount} brouillon(s) personnalisé(s) ne sont pas dans les lots : ouvre la fiche du lieu pour les relire et les valider.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
