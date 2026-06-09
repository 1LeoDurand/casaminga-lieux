import "server-only";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import type { CashClosure, CashEntry, Organization } from "@/lib/types";
import { paymentLabel, sourceLabel, closureTypeLabel } from "@/lib/cash-register-meta";

function euros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: "#1a1a1a",
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  center: { textAlign: "center" },
  header: { marginBottom: 20 },
  orgName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111" },
  subtitle: { fontSize: 10, color: "#555", marginTop: 2 },
  divider: { borderTopWidth: 0.75, borderTopColor: "#d0d0d0", marginVertical: 10 },
  thinDivider: { borderTopWidth: 0.4, borderTopColor: "#e0e0e0", marginVertical: 6 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#888",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  rowLabel: { color: "#555" },
  rowValue: { fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#f0f0f0", padding: 6, borderRadius: 3, marginTop: 4,
  },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  entriesHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 2,
    marginBottom: 2,
  },
  entryRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 0.3,
    borderBottomColor: "#e8e8e8",
  },
  colRef: { width: 70 },
  colDate: { width: 100 },
  colLabel: { flex: 1 },
  colSource: { width: 70 },
  colMethod: { width: 55 },
  colAmount: { width: 55, textAlign: "right" },
  footer: {
    marginTop: 24, paddingTop: 8,
    borderTopWidth: 0.75, borderTopColor: "#d0d0d0",
    fontSize: 7.5, color: "#999", textAlign: "center",
  },
  voidText: { color: "#cc0000" },
  hash: { fontSize: 7, color: "#bbb", fontFamily: "Helvetica", letterSpacing: 0.3 },
  chip: {
    borderWidth: 0.5, borderColor: "#ccc", borderRadius: 2,
    paddingHorizontal: 4, paddingVertical: 1,
    fontSize: 7, color: "#666",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  positiveVariance: { color: "#16a34a" },
  negativeVariance: { color: "#dc2626" },
  neutralVariance: { color: "#16a34a" },
  warningVariance: { color: "#d97706" },
});

function ClosureDoc({
  closure, entries, org,
}: {
  closure: CashClosure;
  entries: CashEntry[];
  org: Organization;
}) {
  // Calculs depuis les écritures de la période
  const realEntries = entries.filter((e) => !e.is_void);
  const voidEntries = entries.filter((e) => e.is_void);

  // Ventilation par mode de paiement
  const byMethod = new Map<string, number>();
  for (const e of realEntries) {
    byMethod.set(e.payment_method, (byMethod.get(e.payment_method) ?? 0) + Number(e.amount_ttc));
  }
  const methodBreakdown = Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]);

  // Ventilation par nature
  const bySource = new Map<string, number>();
  for (const e of realEntries) {
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + Number(e.amount_ttc));
  }
  const sourceBreakdown = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]);

  const hasVoid = voidEntries.length > 0;
  const hasFloat = closure.opening_float !== null || closure.counted_cash !== null;
  const varianceNum = closure.variance;
  const varianceStyle = varianceNum === null ? null
    : varianceNum === 0 ? styles.neutralVariance
    : Math.abs(varianceNum) < 1 ? styles.warningVariance
    : styles.negativeVariance;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── En-tête ── */}
        <View style={styles.header}>
          <View style={styles.row}>
            <View>
              <Text style={styles.orgName}>{org.name}</Text>
              {org.address && <Text style={[styles.muted, { fontSize: 8 }]}>{org.address}</Text>}
              {org.email && <Text style={[styles.muted, { fontSize: 8 }]}>{org.email}</Text>}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.title}>{closureTypeLabel(closure.closure_type)}</Text>
              <Text style={styles.subtitle}>Rapport {closure.closure_type === "jour" ? "Z" : closure.closure_type === "mois" ? "M" : "A"} #{closure.seq}</Text>
              <Text style={[styles.muted, { fontSize: 8, marginTop: 4 }]}>Clôturé le {fmtDateTime(closure.closed_at)}</Text>
              <Text style={[styles.muted, { fontSize: 8 }]}>Opérateur : {closure.operator}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Période ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Période couverte</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Libellé</Text>
            <Text style={styles.rowValue}>{closure.period_label}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Du</Text>
            <Text>{fmtDate(closure.period_start)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Au</Text>
            <Text>{fmtDate(closure.period_end)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Écritures incluses</Text>
            <Text>#{closure.first_entry_seq ?? "—"} → #{closure.last_entry_seq ?? "—"} ({closure.entry_count} écriture{closure.entry_count > 1 ? "s" : ""})</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Totaux ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totaux de la période</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total HT</Text>
            <Text>{euros(Number(closure.total_ht))}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total TVA</Text>
            <Text>{euros(Number(closure.total_vat))}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL TTC</Text>
            <Text style={styles.totalValue}>{euros(Number(closure.total_ttc))}</Text>
          </View>
          <View style={[styles.row, { marginTop: 6 }]}>
            <Text style={styles.rowLabel}>Cumul perpétuel</Text>
            <Text style={styles.rowValue}>{euros(Number(closure.perpetual_total_ttc))}</Text>
          </View>
        </View>

        {/* ── Ventilation TVA ── */}
        {Array.isArray(closure.vat_breakdown) && closure.vat_breakdown.length > 0 && (
          <>
            <View style={styles.thinDivider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ventilation TVA</Text>
              {closure.vat_breakdown.map((v, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowLabel}>TVA {Number(v.rate)} %</Text>
                  <Text>HT {euros(v.ht)} · TVA {euros(v.vat)} · TTC {euros(v.ttc ?? v.ht + v.vat)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Ventilation par mode de paiement ── */}
        {methodBreakdown.length > 0 && (
          <>
            <View style={styles.thinDivider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Répartition par mode de paiement</Text>
              {methodBreakdown.map(([method, val]) => (
                <View key={method} style={styles.row}>
                  <Text style={styles.rowLabel}>{paymentLabel(method)}</Text>
                  <Text>{euros(val)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Ventilation par nature ── */}
        {sourceBreakdown.length > 0 && (
          <>
            <View style={styles.thinDivider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Répartition par nature</Text>
              {sourceBreakdown.map(([src, val]) => (
                <View key={src} style={styles.row}>
                  <Text style={styles.rowLabel}>{sourceLabel(src)}</Text>
                  <Text>{euros(val)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Fond de caisse ── */}
        {hasFloat && (
          <>
            <View style={styles.thinDivider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fond de caisse (espèces)</Text>
              {closure.opening_float !== null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Fond d'ouverture</Text>
                  <Text>{euros(closure.opening_float)}</Text>
                </View>
              )}
              {closure.expected_cash !== null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Espèces théoriques (fond + encaissements)</Text>
                  <Text>{euros(closure.expected_cash)}</Text>
                </View>
              )}
              {closure.counted_cash !== null && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Espèces comptées</Text>
                  <Text>{euros(closure.counted_cash)}</Text>
                </View>
              )}
              {varianceNum !== null && (
                <View style={[styles.row, { marginTop: 2 }]}>
                  <Text style={[styles.rowLabel, styles.bold]}>Écart</Text>
                  <Text style={[styles.bold, varianceStyle ?? {}]}>
                    {varianceNum >= 0 ? "+" : ""}{euros(varianceNum)}
                    {varianceNum !== 0 ? " ⚠" : " ✓"}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Annulations ── */}
        {hasVoid && (
          <>
            <View style={styles.thinDivider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Écritures d'annulation ({voidEntries.length})</Text>
              {voidEntries.map((e) => (
                <View key={e.id} style={styles.row}>
                  <Text style={[styles.voidText]}>{e.ticket_ref} — {e.label}</Text>
                  <Text style={[styles.voidText]}>{euros(Number(e.amount_ttc))}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* ── Intégrité ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Piste d'audit NF525</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Sceau de la clôture</Text>
            <Text style={styles.hash}>{closure.closure_hash}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Sceau précédent</Text>
            <Text style={styles.hash}>{closure.prev_hash}</Text>
          </View>
          <Text style={styles.chip}>Document NF525 conforme — Loi anti-fraude TVA (art. 88 LFR 2015)</Text>
        </View>

        {/* ── Pied de page ── */}
        <View style={styles.footer}>
          <Text>{org.name} — Rapport de clôture #{closure.seq} — Généré le {fmtDateTime(new Date().toISOString())}</Text>
        </View>
      </Page>

      {/* ── Page 2 : Détail des écritures ── */}
      {entries.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={[styles.bold, { fontSize: 11, marginBottom: 10 }]}>
            Détail des écritures — {closure.period_label}
          </Text>

          {/* En-têtes colonnes */}
          <View style={styles.entriesHeader}>
            <Text style={[styles.bold, styles.colRef, { fontSize: 7.5 }]}>N°</Text>
            <Text style={[styles.bold, styles.colDate, { fontSize: 7.5 }]}>Date</Text>
            <Text style={[styles.bold, styles.colLabel, { fontSize: 7.5 }]}>Libellé</Text>
            <Text style={[styles.bold, styles.colSource, { fontSize: 7.5 }]}>Nature</Text>
            <Text style={[styles.bold, styles.colMethod, { fontSize: 7.5 }]}>Paiement</Text>
            <Text style={[styles.bold, styles.colAmount, { fontSize: 7.5 }]}>TTC</Text>
          </View>

          {entries.map((e) => (
            <View key={e.id} style={[styles.entryRow, e.is_void ? { backgroundColor: "#fff5f5" } : {}]}>
              <Text style={[styles.colRef, e.is_void ? styles.voidText : styles.muted, { fontSize: 7.5 }]}>{e.ticket_ref}</Text>
              <Text style={[styles.colDate, styles.muted, { fontSize: 7.5 }]}>{fmtDateTime(e.occurred_at)}</Text>
              <Text style={[styles.colLabel, e.is_void ? styles.voidText : {}, { fontSize: 7.5 }]}>{e.label}</Text>
              <Text style={[styles.colSource, styles.muted, { fontSize: 7.5 }]}>{sourceLabel(e.source)}</Text>
              <Text style={[styles.colMethod, styles.muted, { fontSize: 7.5 }]}>{paymentLabel(e.payment_method)}</Text>
              <Text style={[styles.colAmount, e.amount_ttc < 0 ? styles.voidText : {}, { fontSize: 7.5 }]}>
                {euros(Number(e.amount_ttc))}
              </Text>
            </View>
          ))}

          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total période</Text>
            <Text style={styles.totalValue}>{euros(Number(closure.total_ttc))}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}

export async function renderCashClosurePdf(
  closure: CashClosure,
  entries: CashEntry[],
  org: Organization,
): Promise<Buffer> {
  const buf = await renderToBuffer(
    <ClosureDoc closure={closure} entries={entries} org={org} />
  );
  return buf as Buffer;
}
