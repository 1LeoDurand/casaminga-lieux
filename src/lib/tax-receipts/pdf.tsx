import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { TaxReceipt, InvoiceSettings, DonationType } from "@/lib/invoicing/types";

// ── helpers ──────────────────────────────────────────────────────────────────
function euros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function amountWords(n: number): string {
  // Approximation simple — suffisant pour un reçu Cerfa (mention obligatoire)
  return `${n.toFixed(2).replace(".", ",")} euros`;
}
const DONATION_LABELS: Record<DonationType, string> = {
  numeraire: "Numéraire (espèces)",
  cheque:    "Chèque",
  virement:  "Virement bancaire",
  titres:    "Titres / valeurs mobilières",
  bien:      "Don en nature (bien)",
};

// ── styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:    { padding: 44, fontSize: 9.5, color: "#1A1A1A", fontFamily: "Helvetica", lineHeight: 1.55 },
  title:   { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  ref:     { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#555" },
  bold:    { fontFamily: "Helvetica-Bold" },
  muted:   { color: "#666" },
  row:     { flexDirection: "row", justifyContent: "space-between" },
  sep:     { borderBottomWidth: 1, borderBottomColor: "#DDD", marginVertical: 12 },
  section: { marginBottom: 12 },
  label:   { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  box:     { backgroundColor: "#F7F7F7", borderRadius: 4, padding: 10, marginBottom: 10 },
  amtBox:  { backgroundColor: "#FFF7ED", borderRadius: 4, padding: 10, marginBottom: 10 },
  footer:  { marginTop: "auto", paddingTop: 14, borderTopWidth: 1, borderTopColor: "#DDD", fontSize: 8, color: "#888" },
  cerfa:   { fontSize: 7, color: "#999", textAlign: "right" },
});

// ── composant ─────────────────────────────────────────────────────────────────
function CerfaDoc({ receipt, settings }: { receipt: TaxReceipt; settings: InvoiceSettings }) {
  const issuer = settings.issuer_name ?? "—";
  const quality = settings.tax_receipt_quality ?? "association d'intérêt général";
  const signatory = settings.tax_receipt_signatory ?? issuer;

  return (
    <Document title={`Reçu fiscal ${receipt.number ?? ""}`}>
      <Page size="A4" style={S.page}>

        {/* En-tête émetteur */}
        <View style={[S.row, { marginBottom: 20 }]}>
          <View>
            <Text style={S.title}>{issuer}</Text>
            <Text style={S.muted}>{quality}</Text>
            {settings.issuer_address ? <Text style={S.muted}>{settings.issuer_address}</Text> : null}
            {settings.siret ? <Text style={S.muted}>SIRET : {settings.siret}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.ref}>Reçu fiscal n° {receipt.number ?? "(à émettre)"}</Text>
            <Text style={S.muted}>Émis le {fmtDate(receipt.created_at)}</Text>
          </View>
        </View>

        <View style={S.sep} />

        {/* Titre officiel */}
        <Text style={[S.bold, { fontSize: 11, marginBottom: 6 }]}>
          REÇU AU TITRE DES DONS À CERTAINS ORGANISMES D'INTÉRÊT GÉNÉRAL
        </Text>
        <Text style={[S.muted, { fontSize: 8, marginBottom: 16 }]}>
          Formulaire Cerfa n° 11580*04 — Articles 200, 238 bis et 978 du Code général des impôts
        </Text>

        {/* Donateur */}
        <View style={S.section}>
          <Text style={S.label}>Donateur</Text>
          <View style={S.box}>
            <Text style={S.bold}>{receipt.donor_name}</Text>
            {receipt.donor_address ? <Text style={S.muted}>{receipt.donor_address}</Text> : <Text style={S.muted}>(adresse non renseignée)</Text>}
          </View>
        </View>

        {/* Montant */}
        <View style={S.section}>
          <Text style={S.label}>Montant du don</Text>
          <View style={S.amtBox}>
            <Text style={[S.bold, { fontSize: 13 }]}>{euros(receipt.amount)}</Text>
            <Text style={S.muted}>En lettres : {amountWords(receipt.amount)}</Text>
          </View>
        </View>

        {/* Détails du don */}
        <View style={[S.box, S.section]}>
          <View style={[S.row, { marginBottom: 4 }]}>
            <Text style={S.muted}>Date du don</Text>
            <Text style={S.bold}>{fmtDate(receipt.donation_date)}</Text>
          </View>
          <View style={[S.row, { marginBottom: 4 }]}>
            <Text style={S.muted}>Forme du versement</Text>
            <Text style={S.bold}>{DONATION_LABELS[receipt.donation_type]}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.muted}>Exercice fiscal</Text>
            <Text style={S.bold}>{receipt.fiscal_year}</Text>
          </View>
        </View>

        {/* Objet de l'organisme */}
        <View style={S.section}>
          <Text style={S.label}>L'organisme bénéficiaire déclare</Text>
          <View style={S.box}>
            <Text>
              Que les dons et versements qu'il reçoit ouvrent droit à la réduction d'impôt prévue à l'article 200 du CGI
              (66 % du montant du don dans la limite de 20 % du revenu imposable).
            </Text>
            <Text style={{ marginTop: 6 }}>
              Qu'il est bien <Text style={S.bold}>{quality}</Text>, dont l'activité est non lucrative,
              qu'il n'exerce pas d'activités au profit d'un cercle restreint de personnes,
              et que sa gestion est désintéressée.
            </Text>
          </View>
        </View>

        {/* Signature */}
        <View style={[S.row, { marginTop: 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={S.label}>Fait à</Text>
            <Text>{settings.issuer_address?.split("\n")[0] ?? "—"}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={S.label}>Le signataire</Text>
            <Text style={S.bold}>{signatory}</Text>
            <Text style={[S.muted, { marginTop: 24 }]}>Signature :</Text>
          </View>
        </View>

        {/* Pied de page */}
        <View style={S.footer}>
          <Text>
            Ce reçu est établi en application des articles 200, 238 bis et 978 du CGI et de l'article 4 de la loi n° 87-571 du 23 juillet 1987.
            Il doit être conservé par le donateur pour être présenté à l'administration fiscale en cas de demande.
          </Text>
          <Text style={[S.cerfa, { marginTop: 6 }]}>Cerfa n° 11580*04 · {issuer}</Text>
        </View>

      </Page>
    </Document>
  );
}

export async function renderTaxReceiptPdf(
  receipt: TaxReceipt,
  settings: InvoiceSettings,
): Promise<Buffer> {
  return renderToBuffer(<CerfaDoc receipt={receipt} settings={settings} />);
}
