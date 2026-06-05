"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import {
  type InvoiceLine,
  VAT_RATES,
  PAYMENT_METHODS,
  computeTotals,
  formatEuros,
} from "@/lib/invoicing/types";
import { saveInvoice, type InvoiceInput } from "@/app/(admin)/dashboard/[org]/factures/actions";

interface PersonLite { id: string; name: string; email: string | null }

const input =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InvoiceEditor({
  orgId,
  orgSlug,
  persons,
  defaultTermsDays,
  initial,
  invoiceId,
}: {
  orgId: string;
  orgSlug: string;
  persons: PersonLite[];
  defaultTermsDays: number;
  initial?: Partial<InvoiceInput>;
  invoiceId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState<string | null>(initial?.client_id ?? null);
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.client_email ?? "");
  const [clientAddress, setClientAddress] = useState(initial?.client_address ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? todayISO());
  const [dueDate, setDueDate] = useState(initial?.due_date ?? addDays(todayISO(), defaultTermsDays));
  const [vatApplicable, setVatApplicable] = useState(initial?.vat_applicable ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pole, setPole] = useState(initial?.pole ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(
    initial?.lines ?? [{ designation: "", qty: 1, unit_ht: 0, vat_rate: 0 }]
  );

  const totals = useMemo(() => computeTotals(lines, vatApplicable), [lines, vatApplicable]);

  function pickPerson(id: string) {
    if (!id) { setClientId(null); return; }
    const p = persons.find((x) => x.id === id);
    if (p) {
      setClientId(p.id);
      setClientName(p.name);
      if (p.email) setClientEmail(p.email);
    }
  }

  function updateLine(i: number, patch: Partial<InvoiceLine>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((cur) => [...cur, { designation: "", qty: 1, unit_ht: 0, vat_rate: vatApplicable ? 20 : 0 }]);
  }
  function removeLine(i: number) {
    setLines((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur));
  }

  function save(redirect: boolean) {
    if (!clientName.trim()) { toast.error("Indiquez le nom du client."); return; }
    const payload: InvoiceInput = {
      client_id: clientId,
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      client_address: clientAddress.trim() || null,
      issue_date: issueDate,
      due_date: dueDate,
      lines: lines.filter((l) => l.designation.trim()),
      vat_applicable: vatApplicable,
      notes: notes.trim() || null,
      pole: pole.trim() || null,
      payment_method: paymentMethod || null,
      paid_at: null,
    };
    startTransition(async () => {
      const res = await saveInvoice(orgId, orgSlug, payload, invoiceId);
      if (res.ok && res.id) {
        toast.success("Brouillon enregistré ✓");
        if (redirect) router.push(`/dashboard/${orgSlug}/factures/${res.id}`);
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Client */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="mb-4 font-heading text-base font-bold text-ink">Client</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Depuis le CRM (optionnel)</label>
            <select className={input} value={clientId ?? ""} onChange={(e) => pickPerson(e.target.value)}>
              <option value="">— Saisir manuellement —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nom / raison sociale *</label>
            <input className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={input} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Adresse</label>
            <input className={input} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Dates + TVA */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Date d'émission</label>
            <input type="date" className={input} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Échéance</label>
            <input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>TVA</label>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-border bg-[#FAFAF7] px-3.5 text-sm">
              <input type="checkbox" checked={vatApplicable} onChange={(e) => setVatApplicable(e.target.checked)} className="size-4 accent-coral" />
              Assujettie à la TVA
            </label>
          </div>
        </div>
        {!vatApplicable && (
          <p className="mt-3 text-[12px] text-warmgray">
            Mention automatique : <em>« TVA non applicable, art. 293 B du CGI »</em>
          </p>
        )}
      </div>

      {/* Lignes */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="mb-4 font-heading text-base font-bold text-ink">Lignes</h3>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_90px_auto_auto] items-center gap-2">
              <input
                className={input}
                placeholder="Désignation (ex. Coworking — janvier 2026)"
                value={l.designation}
                onChange={(e) => updateLine(i, { designation: e.target.value })}
              />
              <input
                type="number" min={0} step="0.5" className={`${input} text-center`} title="Quantité"
                value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
              />
              <input
                type="number" min={0} step="0.01" className={`${input} text-right`} title="Prix unitaire HT"
                value={l.unit_ht} onChange={(e) => updateLine(i, { unit_ht: Number(e.target.value) })}
              />
              {vatApplicable ? (
                <select className={`${input} w-[78px]`} value={l.vat_rate} onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) })}>
                  {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              ) : (
                <span className="w-[78px] text-center text-[12px] text-warmgray">—</span>
              )}
              <button onClick={() => removeLine(i)} className="rounded-lg p-2 text-warmgray hover:text-red-600" title="Supprimer">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-coral-dark hover:underline">
          <Plus className="size-4" /> Ajouter une ligne
        </button>

        {/* Totaux */}
        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-warmgray"><span>Total HT</span><span>{formatEuros(totals.total_ht)}</span></div>
            {vatApplicable && <div className="flex justify-between text-warmgray"><span>TVA</span><span>{formatEuros(totals.total_vat)}</span></div>}
            <div className="flex justify-between border-t border-border pt-1.5 font-bold text-ink"><span>Total TTC</span><span>{formatEuros(totals.total_ttc)}</span></div>
          </div>
        </div>
      </div>

      {/* Pôle / activité + mode de règlement */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Pôle / Activité</label>
            <input
              className={input}
              value={pole}
              onChange={(e) => setPole(e.target.value)}
              placeholder="Coworking, Événements, Résidences…"
            />
          </div>
          <div>
            <label className={labelCls}>Mode de règlement</label>
            <select className={input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">— Non précisé —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <label className={labelCls}>Notes (optionnel)</label>
        <textarea className={`${input} min-h-[70px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions particulières, référence…" />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={() => save(false)} disabled={pending} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-ink hover:border-coral/40 disabled:opacity-50">
          <Save className="size-4" /> Enregistrer le brouillon
        </button>
        <button onClick={() => save(true)} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">
          {pending ? "…" : "Enregistrer & ouvrir →"}
        </button>
      </div>
    </div>
  );
}
