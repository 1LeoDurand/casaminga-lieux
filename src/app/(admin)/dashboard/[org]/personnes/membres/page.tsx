import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserCog } from "lucide-react";
import { PageHeader } from "@/components/mc/page-header";
import { MembersAccessList } from "@/components/mc/members-access-list";
import { getOrganizationBySlug, getTeamMembers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MembresAccessPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const members = await getTeamMembers(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        tag="Équipe"
        title="Accès au logiciel"
        sub="Gérez qui a accès au tableau de bord et quelles fonctionnalités chaque membre peut utiliser."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-warmgray">
              <UserCog className="size-3.5" />
              {members.filter((m) => m.status === "actif").length} membre{members.filter((m) => m.status === "actif").length > 1 ? "s" : ""} actif{members.filter((m) => m.status === "actif").length > 1 ? "s" : ""}
            </span>
            <Link
              href={`/dashboard/${org}/personnes`}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-[12px] font-semibold text-foreground transition hover:border-coral/40 hover:bg-peach-pale"
            >
              <ArrowLeft className="size-3.5" /> Retour aux personnes
            </Link>
          </div>
        }
      />

      {/* Légende rôles → permissions */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-warmgray">
          Permissions suggérées par rôle
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 text-left font-semibold text-warmgray">Rôle</th>
                <th className="pb-2 px-2 text-center">📊 Pilotage</th>
                <th className="pb-2 px-2 text-center">🏛 Lieu</th>
                <th className="pb-2 px-2 text-center">🏗 Structure</th>
                <th className="pb-2 px-2 text-center">📢 Publication</th>
                <th className="pb-2 px-2 text-center">⚙️ Système</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Administrateur·ice",  "admin",       true, true, true, true, true],
                  ["Coordinateur·ice",    "coord",       true, true, false,true, false],
                  ["Trésorier·e",         "finance",     true, false,true, false,true],
                  ["Communication",       "comm",        false,true, false,true, false],
                  ["Bénévole",            "benevole",    false,true, false,false,false],
                  ["Intervenant·e",       "intervenant", false,true, false,false,false],
                  ["Lecture seule",       "readonly",    false,false,false,false,false],
                ] as const
              ).map(([label, , ...bools]) => (
                <tr key={label} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-ink">{label}</td>
                  {bools.map((v, i) => (
                    <td key={i} className="py-1.5 px-2 text-center">
                      {v ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-warmgray/70">
          Ces suggestions sont appliquées automatiquement à l&apos;invitation. Tu peux les modifier librement ensuite pour chaque membre.
        </p>
      </div>

      <MembersAccessList
        members={members}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
