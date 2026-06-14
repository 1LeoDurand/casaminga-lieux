import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Attestation d'adhésion (PDF) téléchargeable depuis l'espace adhérent.
 * Document de courtoisie (preuve d'adhésion) — distinct du reçu fiscal Cerfa.
 */

export interface MembershipCertificateData {
  orgName: string;
  memberName: string;
  tierName: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  reference: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const S = StyleSheet.create({
  page:   { padding: 52, fontSize: 11, color: "#1A1A1A", fontFamily: "Helvetica", lineHeight: 1.6 },
  org:    { fontSize: 15, fontFamily: "Helvetica-Bold" },
  title:  { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 40, marginBottom: 6 },
  rule:   { width: 60, height: 3, backgroundColor: "#FF8A65", alignSelf: "center", marginBottom: 30 },
  p:      { marginBottom: 14 },
  bold:   { fontFamily: "Helvetica-Bold" },
  box:    { backgroundColor: "#FAFAF7", borderWidth: 1, borderColor: "#E5DDD6", borderRadius: 6, padding: 18, marginVertical: 18 },
  row:    { flexDirection: "row", marginBottom: 6 },
  label:  { width: 130, color: "#888" },
  value:  { fontFamily: "Helvetica-Bold" },
  footer: { marginTop: "auto", paddingTop: 16, borderTopWidth: 1, borderTopColor: "#DDD", fontSize: 8.5, color: "#888" },
});

function CertificateDoc({ d }: { d: MembershipCertificateData }) {
  const issuedAt = fmtDate(new Date().toISOString());
  return (
    <Document title={`Attestation d'adhésion — ${d.orgName}`}>
      <Page size="A4" style={S.page}>
        <Text style={S.org}>{d.orgName}</Text>

        <Text style={S.title}>Attestation d&apos;adhésion</Text>
        <View style={S.rule} />

        <Text style={S.p}>
          Nous, association <Text style={S.bold}>{d.orgName}</Text>, attestons par la présente que :
        </Text>

        <View style={S.box}>
          <View style={S.row}>
            <Text style={S.label}>Adhérent·e</Text>
            <Text style={S.value}>{d.memberName}</Text>
          </View>
          {d.tierName ? (
            <View style={S.row}>
              <Text style={S.label}>Formule</Text>
              <Text style={S.value}>{d.tierName}</Text>
            </View>
          ) : null}
          <View style={S.row}>
            <Text style={S.label}>Adhésion depuis</Text>
            <Text style={S.value}>{fmtDate(d.membershipStart)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Valable jusqu&apos;au</Text>
            <Text style={S.value}>{fmtDate(d.membershipEnd)}</Text>
          </View>
        </View>

        <Text style={S.p}>
          est à jour de son adhésion et membre de notre association à la date d&apos;émission de la
          présente attestation.
        </Text>
        <Text style={S.p}>
          Cette attestation est délivrée pour servir et valoir ce que de droit.
        </Text>

        <View style={S.footer}>
          <Text>Délivrée le {issuedAt} · Référence {d.reference}</Text>
          <Text>Document généré automatiquement via Casa Minga Lieux.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderMembershipCertificatePdf(
  d: MembershipCertificateData
): Promise<Buffer> {
  return renderToBuffer(<CertificateDoc d={d} />);
}
