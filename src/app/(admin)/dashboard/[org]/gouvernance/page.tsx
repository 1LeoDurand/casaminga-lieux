import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { GouvernanceView } from "@/components/mc/gouvernance-view";
import {
  getOrganizationBySlug, getMeetingsForOrg, getMandatesForOrg, getPersonsForOrg,
  getAssemblyProxies, getAssemblyAttendance,
} from "@/lib/data";
import type { AssemblyProxy, AssemblyAttendance } from "@/lib/types";

export default async function GouvernancePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [meetings, mandates, persons] = await Promise.all([
    getMeetingsForOrg(organization.id),
    getMandatesForOrg(organization.id),
    getPersonsForOrg(organization.id),
  ]);

  // Charger proxies + émargement pour chaque AG
  const agMeetings = meetings.filter((m) => m.is_general_assembly || m.type === "ag");
  const [proxiesArrays, attendanceArrays] = await Promise.all([
    Promise.all(agMeetings.map((m) => getAssemblyProxies(m.id))),
    Promise.all(agMeetings.map((m) => getAssemblyAttendance(m.id))),
  ]);
  const proxiesByMeeting: Record<string, AssemblyProxy[]> = {};
  const attendanceByMeeting: Record<string, AssemblyAttendance[]> = {};
  agMeetings.forEach((m, i) => {
    proxiesByMeeting[m.id] = proxiesArrays[i];
    attendanceByMeeting[m.id] = attendanceArrays[i];
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Vie associative" title="Gouvernance"
        sub="Instances et mandats — réunions (CA, AG, bureau), ordres du jour, comptes-rendus et rôles élus." />
      <GouvernanceView
        meetings={meetings}
        mandates={mandates}
        persons={persons}
        proxiesByMeeting={proxiesByMeeting}
        attendanceByMeeting={attendanceByMeeting}
        orgSlug={organization.slug}
        orgId={organization.id}
      />
    </div>
  );
}
