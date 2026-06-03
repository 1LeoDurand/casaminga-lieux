"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Printer, Send, Pencil } from "lucide-react";
import {
  type Invoice,
  type InvoiceSettings,
  STATUS_META,
  formatEuros,
} from "@/lib/invoicing/types";
import { emitInvoice } from "@/app/(admin)/dashboard/[org]/factures/actions";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function InvoiceDetail({
  invoice,
  settings,
  orgId,
  orgSlug,
}: {
  invoice: Invoice;
  settings: InvoiceSettings;
  orgId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const accent = settings.accent_color || "#FF8A65";
  const isDraft = invoice.status === "brouillon";
  const sm = STATUS_META[invoice.status];

  function emit() {
    startTransition(async () => {
      const res = await emitInvoice(orgId, orgSlug, invoice.id);
      if (res.ok) { toast.success("Facture émise ✓ Numéro attribué."); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/${orgSlug}/factures`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warmgray hover:text-coral-dark">
          <ArrowLeft className="size-4" /> Retour
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${sm.cls}`}>{sm.label}</span>
          {isDraft && (
            <Link href={`/dashboard/${orgSlug}/factures/${invoice.id}/modifier`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40">
              <Pencil className="size-3.5" /> Modifier
            </Link>
          )}
          {isDraft ? (
            <button onClick={emit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-[13px] font-bold text-white hover:bg-coral-dark disabled:opacity-50">
              <Send className="size-3.5" /> {pending ? "Émission…" : "Émettre la facture"}
            </button>
          ) : (
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-[13px] font-bold text-white hover:bg-coral-dark">
              <Printer className="size-3.5" /> Imprimer / PDF
            </button>
          )}
        </div>
      </div>

      {isDraft && (
        <div className="rounded-xl border border-golden/40 bg-golden/10 px-4 py-2.5 text-[13px] text-[#92400e] print:hidden">
          Brouillon — le numéro de facture sera attribué définitivement à l'émission (séquentiel, non modifiable ensuite).
        </div>
      )}

      {/* ════ Document A4 ════ */}
      <div className="invoice-sheet mx-auto w-full max-w-[800px] rounded-2xl border border-border bg-white p-10 shadow-sm print:border-0 print:shadow-none">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-6">
          <div>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="mb-3 h-12 object-contain" />
            ) : null}
            <div className="text-lg font-extrabold text-ink">{settings.issuer_name ?? "Votre structure"}</div>
            {settings.issuer_address && <div className="mt-1 whitespace-pre-line text-[12.5px] text-warmgray">{settings.issuer_address}</div>}
            <div className="mt-1 text-[12.5px] text-warmgray">
              {settings.siret && <div>SIRET : {settings.siret}</div>}
              {settings.vat_number && <div>TVA : {settings.vat_number}</div>}
              {settings.email && <div>{settings.email}</div>}
              {settings.phone && <div>{settings.phone}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold" style={{ color: accent }}>FACTURE</div>
            <div className="mt-1 font-mono text-[15px] font-bold text-ink">{invoice.number ?? "— brouillon —"}</div>
            <div className="mt-3 text-[12.5px] text-warmgray">
              <div>Date : {fmtDate(invoice.issue_date)}</div>
              <div>Échéance : {fmtDate(invoice.due_date)}</div>
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="mt-8 rounded-xl bg-cream px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-warmgray">Facturé à</div>
          <div className="mt-1 text-[15px] font-bold text-ink">{invoice.client_name}</div>
          {invoice.client_address && <div className="whitespace-pre-line text-[12.5px] text-warmgray">{invoice.client_address}</div>}
          {invoice.client_email && <div className="text-[12.5px] text-warmgray">{invoice.client_email}</div>}
        </div>

        {/* Lignes */}
        <table className="mt-8 w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th className="pb-2 text-left font-bold text-ink">Désignation</th>
              <th className="pb-2 text-center font-bold text-ink">Qté</th>
              <th className="pb-2 text-right font-bold text-ink">P.U. HT</th>
              {invoice.vat_applicable && <th className="pb-2 text-right font-bold text-ink">TVA</th>}
              <th className="pb-2 text-right font-bold text-ink">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-2.5 text-ink">{l.designation}</td>
                <td className="py-2.5 text-center text-warmgray">{l.qty}</td>
                <td className="py-2.5 text-right text-warmgray">{formatEuros(l.unit_ht)}</td>
                {invoice.vat_applicable && <td className="py-2.5 text-right text-warmgray">{l.vat_rate}%</td>}
                <td className="py-2.5 text-right font-medium text-ink">{formatEuros(l.qty * l.unit_ht)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-[260px] space-y-1.5 text-[13px]">
            <div className="flex justify-between text-warmgray"><span>Total HT</span><span>{formatEuros(invoice.total_ht)}</span></div>
            {invoice.vat_applicable && <div className="flex justify-between text-warmgray"><span>TVA</span><span>{formatEuros(invoice.total_vat)}</span></div>}
            <div className="flex justify-between rounded-lg px-3 py-2 text-[15px] font-extrabold text-white" style={{ background: accent }}>
              <span>Total TTC</span><span>{formatEuros(invoice.total_ttc)}</span>
            </div>
          </div>
        </div>

        {!invoice.vat_applicable && (
          <p className="mt-4 text-[11.5px] italic text-warmgray">TVA non applicable, art. 293 B du CGI.</p>
        )}

        {invoice.notes && (
          <div className="mt-6 text-[12.5px] text-warmgray"><span className="font-semibold text-ink">Notes : </span>{invoice.notes}</div>
        )}

        {/* Paiement + mentions */}
        <div className="mt-8 border-t border-border pt-5 text-[12px] text-warmgray">
          {(settings.iban || settings.bic) && (
            <div className="mb-2">
              <span className="font-semibold text-ink">Coordonnées de paiement : </span>
              {settings.iban && <>IBAN {settings.iban} </>}
              {settings.bic && <>· BIC {settings.bic}</>}
            </div>
          )}
          {settings.payment_terms_days ? <div>Conditions : paiement à {settings.payment_terms_days} jours.</div> : null}
          {settings.late_penalty && <div>Pénalités de retard : {settings.late_penalty}.</div>}
          {settings.footer_mentions && <div className="mt-2 whitespace-pre-line">{settings.footer_mentions}</div>}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-sheet, .invoice-sheet * { visibility: visible; }
          .invoice-sheet { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0; }
          @page { margin: 16mm; }
        }
      `}</style>
    </div>
  );
}
