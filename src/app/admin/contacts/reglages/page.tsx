import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getProgramAdminData } from "@/lib/outreach/data";
import { getProgramConfigs } from "@/lib/outreach/programs";
import {
  ActivationTab, ContextTab, IdentityTab, KnowledgeTab, RedZonesTab, SettingsTab, StagesTab, SubjectsTab,
} from "@/components/outreach/program-settings";
import { EmptyLine, ProgramSelector, Section } from "@/components/outreach/ui";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ programme?: string; onglet?: string }> };

const TABS = [
  { id: "identite", label: "Identité" },
  { id: "contexte", label: "Contexte" },
  { id: "sujets", label: "Sujets" },
  { id: "zones", label: "Zones rouges" },
  { id: "connaissances", label: "Base de connaissances" },
  { id: "etapes", label: "Étapes" },
  { id: "reglages", label: "Automatisation et rythme" },
  { id: "activation", label: "Activation" },
] as const;

export default async function ProgramSettingsPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const programs = await getProgramConfigs();
  if (programs.length === 0) return <EmptyLine>Aucun programme configuré.</EmptyLine>;

  const program = programs.find((p) => p.slug === sp.programme) ?? programs[0];
  const tab = TABS.find((t) => t.id === sp.onglet)?.id ?? "identite";
  const data = await getProgramAdminData(program.slug);
  if (!data) return <EmptyLine>Programme introuvable.</EmptyLine>;
  const settings = program.settings;

  return (
    <div className="flex flex-col gap-5">
      <ProgramSelector programs={programs} current={program.slug} basePath="/admin/contacts/reglages" extra={{ onglet: tab }} allowAll={false} />

      <nav className="flex flex-wrap gap-1.5" aria-label="Réglages">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/contacts/reglages?programme=${program.slug}&onglet=${t.id}`} className={`mc-chip ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      <Section title={TABS.find((t) => t.id === tab)!.label} hint={`${program.label} · ${data.threadCount} fil(s)`}>
        {tab === "identite" ? <IdentityTab key={program.id} program={program} mailbox={data.mailbox} /> : null}
        {tab === "contexte" ? <ContextTab key={program.id + data.contexts.length + data.contexts.filter((c) => c.active).map((c) => c.id).join()} program={program} contexts={data.contexts} /> : null}
        {tab === "sujets" ? (
          <SubjectsTab
            key={program.id}
            subjects={data.subjects}
            quality={data.quality}
            minReviewed={settings?.auto_min_reviewed ?? 20}
            editedThreshold={settings?.edited_threshold ?? 0.3}
          />
        ) : null}
        {tab === "zones" ? <RedZonesTab key={program.id + data.redZones.length} program={program} zones={data.redZones} /> : null}
        {tab === "connaissances" ? <KnowledgeTab key={program.id + data.knowledge.map((k) => k.id + k.active).join()} program={program} entries={data.knowledge} subjects={data.subjects} /> : null}
        {tab === "etapes" ? <StagesTab key={program.id} program={program} missing={data.missing} /> : null}
        {tab === "reglages" ? <SettingsTab key={program.id + (settings?.updated_at ?? "")} program={program} /> : null}
        {tab === "activation" ? <ActivationTab key={program.id + String(program.active)} program={program} missing={data.missing} mailbox={data.mailbox} /> : null}
      </Section>
    </div>
  );
}
