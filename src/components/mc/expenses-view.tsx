"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Pencil, Trash2, Upload, Loader2, TrendingDown, TrendingUp, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  EXPENSE_CATEGORIES, PAYMENT_METHODS, categoryLabel, categoryEmoji, paymentLabel, fmtDate, fmtEuros,
} from "@/lib/expenses-meta";
import { saveExpense, deleteExpense, type ExpenseInput } from "@/app/(admin)/dashboard/[org]/depenses/actions";
import { LieuBadge } from "@/components/mc/lieu-badge";
import type { Expense, Person, Pole, Establishment, ExpenseCategory } from "@/lib/types";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── Formulaire ─────────────────────────────────────────────────
function ExpenseForm({
  orgId, orgSlug, persons, poles, establishments, defaultEstablishmentId, initial, expenseId, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; persons: Person[]; poles: Pole[];
  establishments: Establishment[]; defaultEstablishmentId: string | null;
  initial?: Partial<ExpenseInput>; expenseId?: string;
  onDone: () => void; onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amountTtc, setAmountTtc] = useState(initial?.amount_ttc != null ? String(initial.amount_ttc) : "");
  const [vatApplicable, setVatApplicable] = useState(initial?.vat_applicable ?? false);
  const [vatAmount, setVatAmount] = useState(initial?.vat_amount != null ? String(initial.vat_amount) : "");
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [supplierName, setSupplierName] = useState(initial?.supplier_name ?? "");
  const [personId, setPersonId] = useState(initial?.supplier_person_id ?? "");
  const [poleId, setPoleId] = useState(initial?.pole_id ?? "");
  const [establishmentId, setEstablishmentId] = useState(initial?.establishment_id ?? defaultEstablishmentId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? "");
  const [paidAt, setPaidAt] = useState(initial?.paid_at ?? "");
  const [receiptUrl, setReceiptUrl] = useState(initial?.receipt_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [spentAt, setSpentAt] = useState(initial?.spent_at ?? todayISO());
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function uploadReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `org/${orgId}/receipts/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("public-assets").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      setReceiptUrl(data.publicUrl);
      toast.success("Justificatif chargé ✓");
    } catch (err) {
      toast.error(`Erreur upload : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!label.trim()) { toast.error("Le libellé est obligatoire."); return; }
    const amount = parseFloat(amountTtc.replace(",", "."));
    if (isNaN(amount) || amount < 0) { toast.error("Montant invalide."); return; }
    const input: ExpenseInput = {
      label: label.trim(),
      amount_ttc: amount,
      vat_applicable: vatApplicable,
      vat_amount: vatApplicable && vatAmount ? parseFloat(vatAmount.replace(",", ".")) : null,
      category: (category || null) as ExpenseCategory | null,
      supplier_name: supplierName.trim() || null,
      supplier_person_id: personId || null,
      pole_id: poleId || null,
      establishment_id: establishmentId || null,
      payment_method: paymentMethod || null,
      paid_at: paidAt || null,
      receipt_url: receiptUrl || null,
      notes: notes.trim() || null,
      spent_at: spentAt,
    };
    startTransition(async () => {
      const res = await saveExpense(orgId, orgSlug, input, expenseId);
      if (res.ok) { toast.success(expenseId ? "Dépense mise à jour" : "Dépense enregistrée"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">
        {expenseId ? "Modifier la dépense" : "Nouvelle dépense"}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Libellé *</label>
          <input className={inputCls} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Loyer atelier, Achat matériel, Prestation…" />
        </div>
        <div>
          <label className={labelCls}>Montant TTC (€) *</label>
          <input className={inputCls} inputMode="decimal" value={amountTtc} onChange={(e) => setAmountTtc(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Date de la dépense</label>
          <input type="date" className={inputCls} value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Catégorie</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Aucune —</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Pôle / Activité</label>
          <select className={inputCls} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
            <option value="">— Aucun —</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {establishments.length > 0 && (
          <div>
            <label className={labelCls}>Lieu</label>
            <select className={inputCls} value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)}>
              <option value="">— Aucun (commun) —</option>
              {establishments.map((es) => <option key={es.id} value={es.id}>{es.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Fournisseur (nom libre)</label>
          <input className={inputCls} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="EDF, SARL Dupont…" />
        </div>
        <div>
          <label className={labelCls}>Ou personne du CRM</label>
          <select className={inputCls} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">— Aucune —</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Mode de règlement</label>
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">— Non précisé —</option>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date de paiement</label>
          <input type="date" className={inputCls} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Justificatif</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-white px-4 py-3 transition-colors hover:border-coral/60">
            {uploading ? <Loader2 className="size-4 animate-spin text-coral" /> : <Upload className="size-4 text-warmgray" />}
            <span className="text-[13px] text-warmgray">
              {uploading ? "Upload…" : receiptUrl ? "✓ Justificatif chargé — cliquer pour remplacer" : "Cliquer pour uploader (PDF, image)"}
            </span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={uploadReceipt} disabled={uploading} />
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, numéro de facture fournisseur…" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending || uploading}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || uploading}>
          {pending ? "…" : expenseId ? "Enregistrer" : "Créer la dépense"}
        </button>
      </div>
    </div>
  );
}

// ── Vue principale ──────────────────────────────────────────────
export function ExpensesView({ expenses, persons, poles, establishments, selectedLieuId, orgSlug, orgId }: {
  expenses: Expense[]; persons: Person[]; poles: Pole[];
  establishments: Establishment[]; selectedLieuId: string | null; orgSlug: string; orgId: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [poleFilter, setPoleFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [, startTransition] = useTransition();

  const poleById = useMemo(() => new Map(poles.map((p) => [p.id, p])), [poles]);

  const kpis = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount_ttc, 0);
    const paid = expenses.filter((e) => !!e.paid_at).reduce((s, e) => s + e.amount_ttc, 0);
    const unpaid = total - paid;
    return { total, paid, unpaid, count: expenses.length };
  }, [expenses]);

  // Récap par pôle (toutes dépenses payées)
  const recapByPole = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (!e.paid_at) continue;
      const pole = e.pole_id ? (poleById.get(e.pole_id)?.name ?? "Inconnu") : "Sans pôle";
      map.set(pole, (map.get(pole) ?? 0) + e.amount_ttc);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses, poleById]);

  const filtered = useMemo(() => {
    let list = expenses;
    if (poleFilter !== "all") list = list.filter((e) => (e.pole_id ?? "sans") === poleFilter);
    if (catFilter !== "all") list = list.filter((e) => (e.category ?? "autre") === catFilter);
    return list;
  }, [expenses, poleFilter, catFilter]);

  function remove(e: Expense) {
    if (!confirm(`Supprimer « ${e.label} » ?`)) return;
    startTransition(async () => {
      const res = await deleteExpense(orgSlug, e.id);
      if (res.ok) toast.success("Dépense supprimée");
      else toast.error(res.error ?? "Erreur");
    });
  }

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Dépenses totales", value: String(kpis.count) },
          { label: "Total TTC", value: fmtEuros(kpis.total) },
          { label: "✅ Payées", value: fmtEuros(kpis.paid), color: "#2f8a4c" },
          { label: "⏳ À payer", value: fmtEuros(kpis.unpaid), color: "#c2410c" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: k.color ?? "#2c2c2c" }}>{k.value}</div>
            <div className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Récap par pôle */}
      {recapByPole.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-warmgray">
            <TrendingDown className="size-3.5" /> Dépenses payées par pôle
          </div>
          <div className="flex flex-wrap gap-3">
            {recapByPole.map(([poleName, total]) => {
              const pole = poles.find((p) => p.name === poleName);
              return (
                <div key={poleName} className="flex items-center gap-2 rounded-xl border border-border bg-cream px-3.5 py-2">
                  {pole && <span className="size-2.5 rounded-full" style={{ background: pole.color }} />}
                  <span className="text-[13px] font-semibold text-ink">{poleName}</span>
                  <span className="text-[13px] font-bold text-red-600">{fmtEuros(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={openCreate} className="mc-btn mc-btn-lime mc-btn-sm ml-auto">
          <Plus className="size-3.5" /> Nouvelle dépense
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPoleFilter("all")}
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${poleFilter === "all" ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
          Tous les pôles
        </button>
        {poles.map((p) => (
          <button key={p.id} onClick={() => setPoleFilter(p.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${poleFilter === p.id ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
            {p.name}
          </button>
        ))}
        {poles.length > 0 && <span className="mx-1 self-center text-warmgray/40">|</span>}
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCatFilter(catFilter === c.value ? "all" : c.value)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${catFilter === c.value ? "border-coral/60 bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/30"}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Formulaire inline */}
      {formOpen && (
        <ExpenseForm
          orgId={orgId}
          orgSlug={orgSlug}
          persons={persons}
          poles={poles}
          establishments={establishments}
          defaultEstablishmentId={selectedLieuId}
          initial={editing ? {
            label: editing.label,
            amount_ttc: editing.amount_ttc,
            vat_applicable: editing.vat_applicable,
            vat_amount: editing.vat_amount,
            category: editing.category,
            supplier_name: editing.supplier_name,
            supplier_person_id: editing.supplier_person_id,
            pole_id: editing.pole_id,
            establishment_id: editing.establishment_id,
            payment_method: editing.payment_method,
            paid_at: editing.paid_at,
            receipt_url: editing.receipt_url,
            notes: editing.notes,
            spent_at: editing.spent_at,
          } : undefined}
          expenseId={editing?.id}
          onDone={closeForm}
          onCancel={closeForm}
        />
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
          <TrendingDown className="mx-auto mb-3 size-8 text-warmgray/50" />
          <p className="text-sm text-warmgray">Aucune dépense enregistrée.</p>
          {!formOpen && (
            <button onClick={openCreate} className="mt-3 inline-block text-sm font-semibold text-coral-dark hover:underline">
              Enregistrer une première dépense →
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_auto] gap-3 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Date</span><span>Libellé</span><span>Catégorie</span><span>Montant TTC</span><span>Pôle</span><span>Règlement</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((e) => {
              const pole = e.pole_id ? poleById.get(e.pole_id) : null;
              const isPaid = !!e.paid_at;
              return (
                <li key={e.id} className="grid grid-cols-1 gap-1.5 px-5 py-3.5 md:grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_auto] md:items-center md:gap-3">
                  <span className="text-[12px] text-warmgray">{fmtDate(e.spent_at)}</span>
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{e.label}</div>
                    {e.supplier_name && <div className="text-[11px] text-warmgray">{e.supplier_name}</div>}
                  </div>
                  <span className="text-[12px] text-warmgray">{categoryEmoji(e.category)} {categoryLabel(e.category)}</span>
                  <div>
                    <div className={`text-[13px] font-semibold ${isPaid ? "text-red-600" : "text-ink"}`}>
                      {fmtEuros(e.amount_ttc)}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-warmgray">
                      {isPaid ? `✅ payé le ${fmtDate(e.paid_at)}` : "⏳ à payer"}
                    </div>
                  </div>
                  <div>
                    {pole ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: `${pole.color}22`, color: pole.color }}>
                        {pole.name}
                      </span>
                    ) : <span className="text-[12px] text-warmgray">—</span>}
                    <LieuBadge establishmentId={e.establishment_id} establishments={establishments} className="mt-1" />
                  </div>
                  <span className="text-[12px] text-warmgray">{paymentLabel(e.payment_method)}</span>
                  <div className="flex items-center gap-1.5">
                    {e.receipt_url && (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40" title="Voir le justificatif">
                        📎
                      </a>
                    )}
                    <button onClick={() => openEdit(e)}
                      className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => remove(e)}
                      className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
