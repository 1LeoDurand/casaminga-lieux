import "server-only";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

function euros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const S = StyleSheet.create({
  page: { padding: 48, fontSize: 9, color: "#1a1a1a", fontFamily: "Helvetica", lineHeight: 1.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  center: { textAlign: "center" },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#E8714D", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 20 },
  divider: { borderTopWidth: 0.75, borderTopColor: "#d0d0d0", marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  value: { fontFamily: "Helvetica-Bold" },
  totalBox: {
    backgroundColor: "#FFF3EE", borderWidth: 0.75, borderColor: "#E8714D",
    borderRadius: 4, padding: 10, marginTop: 16,
    flexDirection: "row", justifyContent: "space-between",
  },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#E8714D" },
  footer: {
    marginTop: 36, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: "#e0e0e0",
    fontSize: 7.5, color: "#aaa", textAlign: "center",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#22C55E20", borderWidth: 0.5, borderColor: "#22C55E60",
    borderRadius: 3, paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 12,
  },
  badgeText: { fontSize: 8, color: "#16a34a", fontFamily: "Helvetica-Bold" },
});

export interface ReceiptData {
  orgName: string;
  receiptRef: string;
  date: string;
  holderName: string;
  holderEmail: string;
  description: string;
  amountEuros: number;
  paymentMethod?: string;
}

function ReceiptDoc({ d }: { d: ReceiptData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* En-tête org */}
        <View style={{ marginBottom: 24 }}>
          <Text style={S.orgName}>{d.orgName}</Text>
          <Text style={[S.muted, { fontSize: 8 }]}>Géré via Casa Minga Lieux</Text>
        </View>

        {/* Titre + badge */}
        <View style={S.badge}><Text style={S.badgeText}>PAIEMENT CONFIRMÉ ✓</Text></View>
        <Text style={S.title}>Reçu de paiement</Text>
        <Text style={S.subtitle}>Référence : {d.receiptRef}</Text>

        <View style={S.divider} />

        {/* Détails */}
        <View style={{ marginBottom: 8 }}>
          <View style={S.row}>
            <Text style={S.label}>Date du paiement</Text>
            <Text style={S.value}>{fmtDate(d.date)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Bénéficiaire</Text>
            <Text style={S.value}>{d.holderName}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Email</Text>
            <Text style={S.value}>{d.holderEmail}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Objet</Text>
            <Text style={S.value}>{d.description}</Text>
          </View>
          {d.paymentMethod && (
            <View style={S.row}>
              <Text style={S.label}>Mode de paiement</Text>
              <Text style={S.value}>{d.paymentMethod}</Text>
            </View>
          )}
        </View>

        {/* Total */}
        <View style={S.totalBox}>
          <Text style={S.totalLabel}>Montant payé</Text>
          <Text style={S.totalValue}>{euros(d.amountEuros)}</Text>
        </View>

        <View style={S.divider} />

        <View style={S.footer}>
          <Text>Ce document constitue un reçu de paiement émis par {d.orgName} via la plateforme Casa Minga Lieux.</Text>
          <Text style={{ marginTop: 4 }}>Réf. Stripe : {d.receiptRef}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generatePaymentReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<ReceiptDoc d={data} />));
}
