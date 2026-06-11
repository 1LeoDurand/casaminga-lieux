import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Meeting, MeetingResolution, AssemblyAttendance, Person, Organization } from "@/lib/types";

// ── helpers ───────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
}

const RESULT_FR: Record<string, string> = {
  adopte: "Adopté",
  rejete: "Rejeté",
  ajourne: "Ajourné",
};
const RESULT_COLOR: Record<string, string> = {
  adopte:  "#166534",
  rejete:  "#991b1b",
  ajourne: "#92400e",
};
const MEETING_TYPE_FR: Record<string, string> = {
  ag:     "Assemblée Générale",
  ca:     "Conseil d'Administration",
  bureau: "Réunion de Bureau",
  autre:  "Réunion",
};

// ── styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:       { padding: 44, fontSize: 9.5, color: "#1A1A1A", fontFamily: "Helvetica", lineHeight: 1.55 },
  title:      { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle:   { fontSize: 10, color: "#666", marginBottom: 18 },
  bold:       { fontFamily: "Helvetica-Bold" },
  muted:      { color: "#666" },
  sep:        { borderBottomWidth: 1, borderBottomColor: "#DDD", marginVertical: 14 },
  section:    { marginBottom: 14 },
  sectionLbl: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  box:        { backgroundColor: "#F7F7F7", borderRadius: 4, padding: 10, marginBottom: 8 },
  row:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  resBox:     { borderRadius: 4, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#E0E0E0" },
  resTitle:   { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  resVotes:   { fontSize: 8.5, color: "#555" },
  resBadge:   { fontSize: 8, fontFamily: "Helvetica-Bold", padding: "2 6", borderRadius: 4 },
  footer:     { marginTop: "auto", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#DDD", fontSize: 8, color: "#888" },
  attendeeName: { fontSize: 9, marginBottom: 2 },
  col2:       { flexDirection: "row", gap: 12 },
  colHalf:    { flex: 1 },
});

// ── composant ─────────────────────────────────────────────────
function PVDoc({
  org, meeting, resolutions, attendance, persons,
}: {
  org: Organization;
  meeting: Meeting;
  resolutions: MeetingResolution[];
  attendance: AssemblyAttendance[];
  persons: Person[];
}) {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const present = attendance.filter((a) => a.present).map((a) => personById.get(a.person_id)?.name ?? "—");
  const meetingTypeLabel = MEETING_TYPE_FR[meeting.type] ?? "Réunion";

  return (
    <Document title={`PV — ${meeting.title}`} author={org.name}>
      <Page size="A4" style={S.page}>
        {/* En-tête */}
        <View style={S.section}>
          <Text style={S.title}>{meetingTypeLabel}</Text>
          <Text style={[S.title, { fontSize: 13 }]}>{meeting.title}</Text>
          <Text style={S.subtitle}>{org.name} · {fmtDate(meeting.date)}</Text>
        </View>

        <View style={S.sep} />

        {/* Informations générales */}
        <View style={S.section}>
          <Text style={S.sectionLbl}>Informations générales</Text>
          <View style={S.box}>
            <View style={S.row}>
              <Text style={S.bold}>Organisation</Text>
              <Text>{org.name}</Text>
            </View>
            <View style={S.row}>
              <Text style={S.bold}>Type</Text>
              <Text>{meetingTypeLabel}</Text>
            </View>
            <View style={S.row}>
              <Text style={S.bold}>Date</Text>
              <Text>{fmtDateTime(meeting.date)}</Text>
            </View>
            <View style={S.row}>
              <Text style={S.bold}>Quorum requis</Text>
              <Text>{meeting.quorum ?? "Non défini"}</Text>
            </View>
          </View>
        </View>

        {/* Présents */}
        {present.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionLbl}>Membres présents ({present.length})</Text>
            <View style={S.box}>
              <View style={S.col2}>
                <View style={S.colHalf}>
                  {present.slice(0, Math.ceil(present.length / 2)).map((n, i) => (
                    <Text key={i} style={S.attendeeName}>· {n}</Text>
                  ))}
                </View>
                <View style={S.colHalf}>
                  {present.slice(Math.ceil(present.length / 2)).map((n, i) => (
                    <Text key={i} style={S.attendeeName}>· {n}</Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Ordre du jour */}
        {meeting.agenda ? (
          <View style={S.section}>
            <Text style={S.sectionLbl}>Ordre du jour</Text>
            <View style={S.box}><Text style={{ fontSize: 9.5 }}>{meeting.agenda}</Text></View>
          </View>
        ) : null}

        <View style={S.sep} />

        {/* Résolutions */}
        {resolutions.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionLbl}>Résolutions votées ({resolutions.length})</Text>
            {resolutions.map((res, i) => (
              <View key={res.id} style={S.resBox}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={S.resTitle}>Résolution {i + 1} — {res.title}</Text>
                  <Text style={[S.resBadge, { color: RESULT_COLOR[res.result] ?? "#555" }]}>
                    {RESULT_FR[res.result] ?? res.result}
                  </Text>
                </View>
                {res.description ? <Text style={[S.resVotes, { marginBottom: 4 }]}>{res.description}</Text> : null}
                <Text style={S.resVotes}>
                  Pour : {res.votes_pour}  ·  Contre : {res.votes_contre}  ·  Abstention : {res.votes_abstention}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Compte-rendu */}
        {meeting.minutes ? (
          <View style={S.section}>
            <Text style={S.sectionLbl}>Compte-rendu</Text>
            <View style={S.box}><Text style={{ fontSize: 9.5 }}>{meeting.minutes}</Text></View>
          </View>
        ) : null}

        {/* Pied */}
        <View style={S.footer}>
          <Text>Procès-verbal généré le {fmtDate(new Date().toISOString())} · {org.name} · Casa Minga Lieux</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPVPdf(opts: {
  org: Organization;
  meeting: Meeting;
  resolutions: MeetingResolution[];
  attendance: AssemblyAttendance[];
  persons: Person[];
}): Promise<Buffer> {
  return renderToBuffer(
    <PVDoc
      org={opts.org}
      meeting={opts.meeting}
      resolutions={opts.resolutions}
      attendance={opts.attendance}
      persons={opts.persons}
    />
  );
}
