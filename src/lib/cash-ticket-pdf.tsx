import "server-only";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import type { CashEntry } from "@/lib/types";
import type { Organization } from "@/lib/types";
import { paymentLabel, sourceLabel } from "@/lib/cash-register-meta";

function euros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const W = 158; // 56 mm en points (1 mm ≈ 2.835 pt) → ~A5 portrait étroit
const styles = StyleSheet.create({
  page: {
    width: W,
    paddingVertical: 18,
    paddingHorizontal: 14,
    fontSize: 8,
    color: "#1a1a1a",
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  center: { textAlign: "center" },
  bold: { fontFamily: "Helvetica-Bold" },
  divider: { borderTopWidth: 0.75, borderTopColor: "#ccc", marginVertical: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  muted: { color: "#777" },
  bigAmount: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginVertical: 6 },
  chip: {
    borderWidth: 0.75, borderColor: "#ccc", borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
    fontSize: 7, textAlign: "center", alignSelf: "center",
  },
  void: { color: "#cc2222" },
  hash: { fontSize: 6, color: "#aaa", textAlign: "center", marginTop: 4 },
});

function TicketDoc({
  entry, org, personName,
}: {
  entry: CashEntry;
  org: Organization;
  personName?: string | null;
}) {
  const rate = Number(entry.vat_rate);
  const hasVat = rate > 0;

  return (
    <Document>
      <Page size={[W, 600]} style={styles.page} wrap={false}>
        {/* En-tête */}
        <Text style={[styles.bold, styles.center, { fontSize: 10 }]}>{org.name}</Text>
        {org.address && <Text style={[styles.muted, styles.center, { fontSize: 7 }]}>{org.address}</Text>}
        {org.email && <Text style={[styles.muted, styles.center, { fontSize: 7 }]}>{org.email}</Text>}

        <View style={styles.divider} />

        {/* Ticket ref + date */}
        <Text style={[styles.bold, styles.center, { fontSize: 9 }]}>{entry.ticket_ref}</Text>
        <Text style={[styles.muted, styles.center]}>{fmtDateTime(entry.occurred_at)}</Text>

        {entry.is_void && (
          <Text style={[styles.void, styles.center, styles.bold, { marginTop: 4 }]}>
            ⚠ ÉCRITURE ANNULÉE
          </Text>
        )}

        <View style={styles.divider} />

        {/* Libellé */}
        <Text style={[styles.bold, { marginBottom: 4, fontSize: 9 }]}>{entry.label}</Text>

        {/* Nature + paiement */}
        <View style={styles.row}>
          <Text style={styles.muted}>Nature</Text>
          <Text>{sourceLabel(entry.source)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>Paiement</Text>
          <Text>{paymentLabel(entry.payment_method)}</Text>
        </View>

        {/* Client lié */}
        {personName && (
          <View style={styles.row}>
            <Text style={styles.muted}>Client</Text>
            <Text>{personName}</Text>
          </View>
        )}

        {/* Référence */}
        {entry.source_ref && (
          <View style={styles.row}>
            <Text style={styles.muted}>Réf.</Text>
            <Text>{entry.source_ref}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Montant */}
        <Text style={styles.bigAmount}>{euros(Number(entry.amount_ttc))}</Text>

        {hasVat && (
          <>
            <View style={styles.row}>
              <Text style={styles.muted}>Montant HT</Text>
              <Text>{euros(Number(entry.amount_ht))}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.muted}>TVA {rate} %</Text>
              <Text>{euros(Number(entry.amount_vat))}</Text>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* Opérateur + conformité */}
        <View style={styles.row}>
          <Text style={styles.muted}>Opérateur</Text>
          <Text>{entry.operator}</Text>
        </View>
        <Text style={[styles.chip, { marginTop: 6 }]}>Conforme loi anti-fraude TVA · NF525</Text>

        {/* Sceau (hash partiel) */}
        <Text style={styles.hash}>
          #{entry.seq} · {entry.entry_hash?.slice(0, 12) ?? "—"}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderCashTicketPdf(
  entry: CashEntry,
  org: Organization,
  personName?: string | null,
): Promise<Buffer> {
  const buf = await renderToBuffer(
    <TicketDoc entry={entry} org={org} personName={personName} />
  );
  return buf as Buffer;
}
