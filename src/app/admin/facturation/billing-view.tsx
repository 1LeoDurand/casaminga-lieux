"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, X, Trash2, Download, Send, Check, Pencil, FileText } from "lucide-react";
import {
  computeTotals,
  formatEuros,
  SA_STATUS_META,
  type InvoiceLine,
  type SaInvoice,
  type SaClient,
  type SaPricingItem,
  type SaInvoiceSettings,
  type SaInvoiceStatus,
} from "@/lib/superadmin-billing/types";
import {
  saveSaInvoice,
  deleteSaInvoice,
  markSaInvoicePaid,
  sendSaInvoice,
  type SaInvoiceInput,
} from "./actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(base: string, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface EditorState {
  id?: string;
  object: string;
  status: SaInvoiceStatus;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  vatApplicable: boolean;
  notes: string;
}

function blankEditor(settings: SaInvoiceSettings): EditorState {
  const issue = todayISO();
  return {
    object: "",
    status: "brouillon",
    clientId: "",
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    issueDate: issue,
    dueDate: addDaysISO(issue, settings.payment_terms_days || 30),
    lines: [{ designation: "", qty: 1, unit_ht: 0, vat_rate: settings.vat_applicable ? 20 : 0 }],
    vatApplicable: settings.vat_applicable,
    notes: "",
  };
}

function fromInvoice(inv: SaInvoice): EditorState {
  return {
    id: inv.id,
    object: inv.object ?? "",
    status: inv.status,
    clientId: inv.client_id ?? "",
    clientName: inv.client_name,
    clientEmail: inv.client_email ?? "",
    clientAddress: inv.client_address ?? "",
    issueDate: inv.issue_date ?? todayISO(),
    dueDate: inv.due_date ?? "",
    lines: inv.lines.length ? inv.lines : [{ designation: "", qty: 1, unit_ht: 0, vat_rate: 0 }],
    vatApplicable: inv.vat_applicable,
    notes: inv.notes ?? "",
  };
}

export function BillingView({
  invoices,
  clients,
  pricingItems,
  settings,
}: {
  invoices: SaInvoice[];
  clients: SaClient[];
  pricingItems: SaPricingItem[];
  settings: SaInvoiceSettings;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const totals = editor ? computeTotals(editor.lines, editor.vatApplicable) : null;

  function openNew() {
    setError(null);
    setEditor(blankEditor(settings));
  }
  function openEdit(inv: SaInvoice) {
    setError(null);
    setEditor(fromInvoice(inv));
  }

  function pickClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setEditor((s) =>
      s
        ? {
            ...s,
            clientId: id,
            clientName: c?.name ?? s.clientName,
            clientEmail: c?.email ?? s.clientEmail,
            clientAddress: c?.address ?? s.clientAddress,
          }
        : s
    );
  }

  function setLine(i: number, patch: Partial<InvoiceLine>) {
    setEditor((s) => (s ? { ...s, lines: s.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : s));
  }
  function addLine(item?: SaPricingItem) {
    setEditor((s) =>
      s
        ? {
            ...s,
            lines: [
              ...s.lines,
              item
                ? { designation: item.label, qty: 1, unit_ht: item.unit_ht, vat_rate: item.vat_rate }
                : { designation: "", qty: 1, unit_ht: 0, vat_rate: s.vatApplicable ? 20 : 0 },
            ],
          }
        : s
    );
  }
  function removeLine(i: number) {
    setEditor((s) => (s ? { ...s, lines: s.lines.filter((_, j) => j !== i) } : s));
  }

  function save(emit: boolean) {
    if (!editor) return;
    if (!editor.clientName.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }
    if (!editor.lines.some((l) => l.designation.trim())) {
      setError("Ajoutez au moins une ligne avec une désignation.");
      return;
    }
    const status: SaInvoiceStatus =
      emit && editor.status === "brouillon" ? "emise" : editor.status;
    const input: SaInvoiceInput = {
      id: editor.id,
      object: editor.object.trim() || null,
      status,
      client_id: editor.clientId || null,
      client_name: editor.clientName.trim(),
      client_email: editor.clientEmail.trim() || null,
      client_address: editor.clientAddress.trim() || null,
      issue_date: editor.issueDate || null,
      due_date: editor.dueDate || null,
      lines: editor.lines.filter((l) => l.designation.trim()),
      vat_applicable: editor.vatApplicable,
      notes: editor.notes.trim() || null,
      payment_method: null,
      paid_at: null,
    };
    setError(null);
    start(async () => {
      const res = await saveSaInvoice(input);
      if (!res.ok) setError(res.error ?? "Erreur");
      else setEditor(null);
    });
  }

  function onDelete(id: string) {
    if (!confirm("Supprimer définitivement cette facture ?")) return;
    start(async () => {
      const res = await deleteSaInvoice(id);
      if (!res.ok) alert(res.error);
    });
  }
  function onTogglePaid(inv: SaInvoice) {
    start(async () => {
      const res = await markSaInvoicePaid(inv.id, inv.status !== "payee");
      if (!res.ok) alert(res.error);
    });
  }
  function onSend(inv: SaInvoice) {
    if (!confirm(`Envoyer la facture ${inv.number ?? ""} à ${inv.client_email ?? "?"} ?`)) return;
    start(async () => {
      const res = await sendSaInvoice(inv.id);
      if (!res.ok) alert(res.error);
      else alert("Facture envoyée ✓");
    });
  }

  const totalCA = useMemo(
    () => invoices.filter((i) => i.status === "payee").reduce((s, i) => s + i.total_ttc, 0),
    [invoices]
  );
  const totalDue = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "emise" || i.status === "envoyee")
        .reduce((s, i) => s + i.total_ttc, 0),
    [invoices]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E5DDD6] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-warmgray">Encaissé (payées)</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{formatEuros(totalCA)}</div>
        </div>
        <div className="rounded-xl border border-[#E5DDD6] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-warmgray">En attente de paiement</div>
          <div className="mt-1 text-xl font-bold text-blue-600">{formatEuros(totalDue)}</div>
        </div>
        <div className="rounded-xl border border-[#E5DDD6] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-warmgray">Factures</div>
          <div className="mt-1 text-xl font-bold text-foreground">{invoices.length}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={openNew}>
          <Plus className="size-4" /> Nouvelle facture
        </button>
      </div>

      {/* Liste */}
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DDD6] bg-white/50 px-6 py-12 text-center">
          <FileText className="mx-auto size-8 text-warmgray" />
          <p className="mt-2 text-sm text-warmgray">Aucune facture pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5DDD6] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5DDD6] text-left text-[11px] uppercase tracking-wide text-warmgray">
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Objet</th>
                <th className="px-4 py-3 text-right">Montant TTC</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const meta = SA_STATUS_META[inv.status];
                return (
                  <tr key={inv.id} className="border-b border-[#F0E8E0] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.number ?? "—"}</td>
                    <td className="px-4 py-3">{inv.client_name}</td>
                    <td className="px-4 py-3 text-warmgray">{inv.object ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatEuros(inv.total_ttc)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" title="Modifier" className="rounded p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => openEdit(inv)}>
                          <Pencil className="size-4" />
                        </button>
                        {inv.number && (
                          <a title="PDF" href={`/admin/facturation/${inv.id}/pdf`} target="_blank" rel="noopener" className="rounded p-1.5 text-warmgray hover:bg-peach-pale">
                            <Download className="size-4" />
                          </a>
                        )}
                        {inv.number && inv.client_email && (
                          <button type="button" title="Envoyer par email" className="rounded p-1.5 text-indigo-500 hover:bg-indigo-50" onClick={() => onSend(inv)} disabled={pending}>
                            <Send className="size-4" />
                          </button>
                        )}
                        <button type="button" title={inv.status === "payee" ? "Marquer impayée" : "Marquer payée"} className={`rounded p-1.5 hover:bg-emerald-50 ${inv.status === "payee" ? "text-emerald-600" : "text-warmgray"}`} onClick={() => onTogglePaid(inv)} disabled={pending}>
                          <Check className="size-4" />
                        </button>
                        <button type="button" title="Supprimer" className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={() => onDelete(inv.id)} disabled={pending}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Éditeur */}
      {editor && (
        <div className="mc-modal-ov" role="presentation" onClick={() => !pending && setEditor(null)}>
          <div className="mc-modal max-h-[92vh] w-[680px] max-w-[95vw] overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-heading text-xl font-bold text-foreground">
                {editor.id ? "Modifier la facture" : "Nouvelle facture"}
              </h2>
              <button type="button" onClick={() => setEditor(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Client */}
              {clients.length > 0 && (
                <div className="mc-form-group">
                  <label className="mc-form-label">Client enregistré</label>
                  <select className="mc-input" value={editor.clientId} onChange={(e) => pickClient(e.target.value)}>
                    <option value="">— Saisie libre —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="mc-form-group">
                  <label className="mc-form-label">Nom client *</label>
                  <input className="mc-input" value={editor.clientName} onChange={(e) => setEditor((s) => s && { ...s, clientName: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Email client</label>
                  <input className="mc-input" type="email" value={editor.clientEmail} onChange={(e) => setEditor((s) => s && { ...s, clientEmail: e.target.value })} />
                </div>
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Adresse client</label>
                <input className="mc-input" value={editor.clientAddress} onChange={(e) => setEditor((s) => s && { ...s, clientAddress: e.target.value })} />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Objet</label>
                <input className="mc-input" value={editor.object} onChange={(e) => setEditor((s) => s && { ...s, object: e.target.value })} placeholder="Forfait mensuel — prestation d'appui…" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="mc-form-group">
                  <label className="mc-form-label">Date d&apos;émission</label>
                  <input className="mc-input" type="date" value={editor.issueDate} onChange={(e) => setEditor((s) => s && { ...s, issueDate: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Échéance</label>
                  <input className="mc-input" type="date" value={editor.dueDate} onChange={(e) => setEditor((s) => s && { ...s, dueDate: e.target.value })} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Statut</label>
                  <select className="mc-input" value={editor.status} onChange={(e) => setEditor((s) => s && { ...s, status: e.target.value as SaInvoiceStatus })}>
                    {(Object.keys(SA_STATUS_META) as SaInvoiceStatus[]).map((k) => <option key={k} value={k}>{SA_STATUS_META[k].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Lignes */}
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-warmgray">Lignes</p>
                <label className="flex items-center gap-2 text-xs text-warmgray">
                  <input type="checkbox" checked={editor.vatApplicable} onChange={(e) => setEditor((s) => s && { ...s, vatApplicable: e.target.checked })} />
                  Assujetti à la TVA
                </label>
              </div>
              {editor.lines.map((l, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="mc-form-group flex-1">
                    <input className="mc-input" placeholder="Désignation" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} />
                  </div>
                  <div className="mc-form-group w-16">
                    <input className="mc-input" type="number" min="0" step="0.5" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} title="Qté" />
                  </div>
                  <div className="mc-form-group w-24">
                    <input className="mc-input" type="number" min="0" step="0.01" value={l.unit_ht} onChange={(e) => setLine(i, { unit_ht: Number(e.target.value) })} title="P.U. HT" />
                  </div>
                  {editor.vatApplicable && (
                    <div className="mc-form-group w-16">
                      <input className="mc-input" type="number" min="0" step="0.1" value={l.vat_rate} onChange={(e) => setLine(i, { vat_rate: Number(e.target.value) })} title="TVA %" />
                    </div>
                  )}
                  <button type="button" className="mb-1 rounded p-2 text-red-400 hover:bg-red-50" onClick={() => removeLine(i)}><Trash2 className="size-4" /></button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => addLine()}><Plus className="size-3.5" /> Ligne</button>
                {pricingItems.filter((p) => p.active).map((p) => (
                  <button key={p.id} type="button" className="rounded-full border border-[#E5DDD6] px-3 py-1 text-xs text-warmgray hover:bg-peach-pale" onClick={() => addLine(p)} title={`${formatEuros(p.unit_ht)}`}>
                    + {p.label}
                  </button>
                ))}
              </div>

              {totals && (
                <div className="ml-auto w-56 rounded-lg bg-[#FFFBF0] p-3 text-sm">
                  <div className="flex justify-between text-warmgray"><span>Total HT</span><span>{formatEuros(totals.total_ht)}</span></div>
                  {editor.vatApplicable && <div className="flex justify-between text-warmgray"><span>TVA</span><span>{formatEuros(totals.total_vat)}</span></div>}
                  <div className="mt-1 flex justify-between font-bold text-foreground"><span>Total TTC</span><span>{formatEuros(totals.total_ttc)}</span></div>
                </div>
              )}

              <div className="mc-form-group">
                <label className="mc-form-label">Notes</label>
                <textarea className="mc-textarea" rows={2} value={editor.notes} onChange={(e) => setEditor((s) => s && { ...s, notes: e.target.value })} />
              </div>

              {error && <p className="text-sm font-medium text-coral-dark">{error}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setEditor(null)} disabled={pending}>Annuler</button>
              <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => save(false)} disabled={pending}>Enregistrer brouillon</button>
              <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={() => save(true)} disabled={pending}>
                {pending ? "…" : editor.id ? "Enregistrer" : "Émettre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
