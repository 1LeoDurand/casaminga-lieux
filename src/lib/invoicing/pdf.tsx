import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Invoice, InvoiceSettings } from "./types";

function euros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, color: "#2C2C2C", fontFamily: "Helvetica", lineHeight: 1.5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  issuerName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  muted: { color: "#6B6460" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  number: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  clientBox: { backgroundColor: "#FFFBF0", borderRadius: 6, padding: 12, marginTop: 24 },
  label: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#6B6460", textTransform: "uppercase", letterSpacing: 0.5 },
  th: { fontFamily: "Helvetica-Bold", paddingBottom: 5 },
  td: { paddingVertical: 5 },
  cellDesign: { flex: 4 },
  cellQty: { flex: 1, textAlign: "center" },
  cellPu: { flex: 1.4, textAlign: "right" },
  cellVat: { flex: 1, textAlign: "right" },
  cellTot: { flex: 1.6, textAlign: "right" },
  totalsBox: { width: 220, marginLeft: "auto", marginTop: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  footer: { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E5DDD6", fontSize: 8.5, color: "#6B6460" },
});

function InvoiceDoc({ invoice, settings }: { invoice: Invoice; settings: InvoiceSettings }) {
  const accent = settings.accent_color || "#FF8A65";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.row}>
          <View style={{ maxWidth: 280 }}>
            <Text style={styles.issuerName}>{settings.issuer_name ?? "Votre structure"}</Text>
            {settings.issuer_address ? <Text style={styles.muted}>{settings.issuer_address}</Text> : null}
            {settings.siret ? <Text style={styles.muted}>SIRET : {settings.siret}</Text> : null}
            {settings.vat_number ? <Text style={styles.muted}>TVA : {settings.vat_number}</Text> : null}
            {settings.email ? <Text style={styles.muted}>{settings.email}</Text> : null}
            {settings.phone ? <Text style={styles.muted}>{settings.phone}</Text> : null}
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={[styles.title, { color: accent }]}>FACTURE</Text>
            <Text style={styles.number}>{invoice.number ?? "— brouillon —"}</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>Date : {fmtDate(invoice.issue_date)}</Text>
            <Text style={styles.muted}>Échéance : {fmtDate(invoice.due_date)}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientBox}>
          <Text style={styles.label}>Facturé à</Text>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{invoice.client_name}</Text>
          {invoice.client_address ? <Text style={styles.muted}>{invoice.client_address}</Text> : null}
          {invoice.client_email ? <Text style={styles.muted}>{invoice.client_email}</Text> : null}
        </View>

        {/* Tableau */}
        <View style={{ marginTop: 24 }}>
          <View style={[styles.row, { borderBottomWidth: 2, borderBottomColor: accent }]}>
            <Text style={[styles.th, styles.cellDesign]}>Désignation</Text>
            <Text style={[styles.th, styles.cellQty]}>Qté</Text>
            <Text style={[styles.th, styles.cellPu]}>P.U. HT</Text>
            {invoice.vat_applicable ? <Text style={[styles.th, styles.cellVat]}>TVA</Text> : null}
            <Text style={[styles.th, styles.cellTot]}>Total HT</Text>
          </View>
          {invoice.lines.map((l, i) => (
            <View key={i} style={[styles.row, { borderBottomWidth: 1, borderBottomColor: "#E5DDD6" }]}>
              <Text style={[styles.td, styles.cellDesign]}>{l.designation}</Text>
              <Text style={[styles.td, styles.cellQty, styles.muted]}>{l.qty}</Text>
              <Text style={[styles.td, styles.cellPu, styles.muted]}>{euros(l.unit_ht)}</Text>
              {invoice.vat_applicable ? <Text style={[styles.td, styles.cellVat, styles.muted]}>{l.vat_rate}%</Text> : null}
              <Text style={[styles.td, styles.cellTot]}>{euros(l.qty * l.unit_ht)}</Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text style={styles.muted}>Total HT</Text><Text style={styles.muted}>{euros(invoice.total_ht)}</Text></View>
          {invoice.vat_applicable ? (
            <View style={styles.totalRow}><Text style={styles.muted}>TVA</Text><Text style={styles.muted}>{euros(invoice.total_vat)}</Text></View>
          ) : null}
          <View style={[styles.totalRow, { backgroundColor: accent, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, marginTop: 3 }]}>
            <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>Total TTC</Text>
            <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{euros(invoice.total_ttc)}</Text>
          </View>
        </View>

        {!invoice.vat_applicable ? (
          <Text style={{ marginTop: 12, fontStyle: "italic", color: "#6B6460" }}>TVA non applicable, art. 293 B du CGI.</Text>
        ) : null}

        {invoice.notes ? <Text style={{ marginTop: 14 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Notes : </Text>{invoice.notes}</Text> : null}

        {/* Pied */}
        <View style={styles.footer}>
          {(settings.iban || settings.bic) ? (
            <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Coordonnées de paiement : </Text>
              {settings.iban ? `IBAN ${settings.iban} ` : ""}{settings.bic ? `· BIC ${settings.bic}` : ""}</Text>
          ) : null}
          {settings.payment_terms_days ? <Text>Conditions : paiement à {settings.payment_terms_days} jours.</Text> : null}
          {settings.late_penalty ? <Text>Pénalités de retard : {settings.late_penalty}.</Text> : null}
          {settings.footer_mentions ? <Text style={{ marginTop: 6 }}>{settings.footer_mentions}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

/** Génère le PDF d'une facture en Buffer (téléchargement ou pièce jointe email). */
export async function renderInvoicePdf(invoice: Invoice, settings: InvoiceSettings): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc invoice={invoice} settings={settings} />);
}
