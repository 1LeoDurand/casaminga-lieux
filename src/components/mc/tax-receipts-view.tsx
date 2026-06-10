"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Download, FileText, Gift, ChevronDown, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { createTaxReceiptAction, sendTaxReceiptAction } from "@/app/(admin)/dashboard/[org]/factures/recus/actions";
import { DONATION_TYPES } from "@/lib/invoicing/types";
import type { TaxReceipt, DonationType } from "@/lib/invoicing/types";
import type { Person } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

function euros(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function currentYear() { return new Date().getFullYear(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── Bouton envoi email ────────────────────────────────────────────────────────
function SendButton({ orgSlug, receiptId, hasEmail }: { orgSlug: string; receiptId: string; hasEmail: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      const res = await sendTaxReceiptAction(orgSlug, receiptId);
      if (res.ok) toast.success("Reçu envoyé par email.");
      else toast.error(res.error ?? "Erreur lors de l'envoi.");
    });
  }

  if (!hasEmail) {
    return (
      <span
        title="Lier ce reçu à un membre (fiche avec email) pour activer l'envoi"
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-warmgray/40"
      >
        <Send className="size-3.5" /> Envoyer
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={pending}
      title="Envoyer le reçu par email au donateur"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-peach-pale transition-colors disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
      Envoyer
    </button>
  );
}

// ── Formulaire nouveau reçu ───────────────────────────────────────────────────
function ReceiptForm({
  orgSlug, persons, onDone, onCancel,
}: {
  orgSlug: string;
  persons: Person[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [donorName, setDonorName]       = useState("");
  const [donorAddress, setDonorAddress] = useState("");
  const [amount, setAmount]             = useState("");
  const [date, setDate]                 = useState(todayISO());
  const [type, setType]                 = useState<DonationType>("numeraire");
  const [year, setYear]                 = useState(String(currentYear()));
  const [personId, setPersonId]         = useState("");
  const [pending, startTransition]      = useTransition();

  // Quand on choisit un membre, pré-remplir le nom
  function handlePersonChange(id: string) {
    setPersonId(id);
    if (id) {
      const p = persons.find((x) => x.id === id);
      if (p && !donorName) setDonorName(p.name);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!donorName.trim()) { toast.error("Nom du donateur requis."); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Montant invalide."); return; }
    startTransition(async () => {
      const res = await createTaxReceiptAction(orgSlug, {
        donorName, donorAddress, amount, donationDate: date,
        donationType: type, fiscalYear: year,
        donorPersonId: personId || undefined,
      });
      if (res.ok) { toast.success("Reçu fiscal émis."); onDone(); }
      else toast.error(res.error ?? "Erreur lors de l'émission.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Membre CRM (optionnel) */}
      <div>
        <label className={labelCls}>Membre (optionnel)</label>
        <select value={personId} onChange={(e) => handlePersonChange(e.target.value)} className={inputCls}>
          <option value="">— Saisie manuelle —</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Donateur */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nom du donateur *</label>
          <input value={donorName} onChange={(e) => setDonorName(e.target.value)} required className={inputCls} placeholder="Jean Dupont" />
        </div>
        <div>
          <label className={labelCls}>Montant (€) *</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} placeholder="50.00" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Adresse du donateur</label>
        <textarea value={donorAddress} onChange={(e) => setDonorAddress(e.target.value)} rows={2} className={inputCls} placeholder="12 rue de la Paix, 75001 Paris" />
      </div>

      {/* Date + type */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Date du don *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Forme du versement *</label>
          <select value={type} onChange={(e) => setType(e.target.value as DonationType)} className={inputCls}>
            {DONATION_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Exercice fiscal *</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
            {[currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-peach-pale">
          Annuler
        </button>
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-dark disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Émettre le reçu
        </button>
      </div>
    </form>
  );
}

// ── Vue principale ────────────────────────────────────────────────────────────
export function TaxReceiptsView({
  receipts,
  persons,
  orgSlug,
  eligible = false,
  rescritRef = null,
}: {
  receipts: TaxReceipt[];
  persons: Person[];
  orgSlug: string;
  eligible?: boolean;
  rescritRef?: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState<string>(String(currentYear()));

  const years = useMemo(() => {
    const ys = new Set(receipts.map((r) => String(r.fiscal_year)));
    ys.add(String(currentYear()));
    return Array.from(ys).sort((a, b) => Number(b) - Number(a));
  }, [receipts]);

  const filtered = useMemo(() =>
    receipts.filter((r) => !filterYear || String(r.fiscal_year) === filterYear),
    [receipts, filterYear],
  );

  const totalFiltered = useMemo(() =>
    filtered.reduce((s, r) => s + Number(r.amount), 0),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
            <Gift className="size-4 text-emerald-700" />
          </span>
          <div>
            <div className="text-[15px] font-bold text-ink">Reçus fiscaux</div>
            <div className="text-[12px] text-warmgray">Cerfa n° 11580*04 — Dons déductibles d'impôt (art. 200 CGI)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="">Toutes les années</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-dark"
          >
            <Plus className="size-4" /> Émettre un reçu
          </button>
        </div>
      </div>

      {/* Garde-fou éligibilité (art. 200 CGI / amende 1740 A) */}
      {!eligible && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-[18px]">⛔</span>
            <div className="text-[13px] leading-relaxed text-red-900">
              <strong>Éligibilité non confirmée.</strong>{" "}
              Toutes les associations ne peuvent pas émettre
              de reçus fiscaux : il faut être d&apos;intérêt général (art. 200 CGI), à gestion désintéressée,
              et ne pas servir un cercle restreint de personnes. Un reçu émis à tort expose l&apos;association
              à une amende de <strong>60 à 75 % des montants</strong> (art. 1740 A CGI).
              <br />
              <a href={`/dashboard/${orgSlug}/factures/parametres`} className="font-semibold text-red-700 underline">
                Confirmer l&apos;éligibilité dans Paramètres → Facturation
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-[14px] font-bold text-ink">Nouveau reçu fiscal</h3>
          <ReceiptForm
            orgSlug={orgSlug}
            persons={persons}
            onDone={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Déclaration annuelle (obligation loi du 24/08/2021) */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <Gift className="size-5 text-emerald-600" />
            <div>
              <span className="text-[13px] font-semibold text-emerald-800">
                Déclaration annuelle {filterYear || "(filtrez par année)"}
              </span>
              <span className="ml-3 text-[15px] font-bold text-emerald-800">{euros(totalFiltered)}</span>
              <span className="ml-2 text-[13px] text-emerald-700">
                · {filtered.length} reçu{filtered.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-emerald-700">
            Depuis la loi du 24 août 2021, toute association qui émet des reçus fiscaux doit déclarer
            chaque année à l&apos;administration le <strong>montant global des dons</strong> et le{" "}
            <strong>nombre de reçus émis</strong>. Reportez les deux chiffres ci-dessus dans votre
            déclaration (formulaire n° 2070, ou en ligne sur demarches-simplifiees.fr selon votre cas).
          </p>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <Gift className="size-10 text-warmgray/40" />
          <div className="text-[14px] font-semibold text-warmgray">Aucun reçu fiscal</div>
          <div className="text-[12px] text-warmgray/70">
            {filterYear ? `Aucun don enregistré pour ${filterYear}.` : "Émettez votre premier reçu fiscal."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-peach-pale">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">Numéro</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">Donateur</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">Date</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">Forme</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-warmgray">Montant</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-peach-pale/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-[12px] text-warmgray">
                    {r.number ?? <span className="text-amber-500">En attente</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-ink">{r.donor_name}</div>
                    {r.donor_address && (
                      <div className="text-[11px] text-warmgray truncate max-w-[200px]">{r.donor_address}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-ink">{fmtDate(r.donation_date)}</td>
                  <td className="px-5 py-3 text-[13px] text-warmgray capitalize">
                    {DONATION_TYPES.find((d) => d.value === r.donation_type)?.label ?? r.donation_type}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-ink">{euros(Number(r.amount))}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <SendButton orgSlug={orgSlug} receiptId={r.id} hasEmail={!!r.donor_person_id} />
                      <a
                        href={`/dashboard/${orgSlug}/factures/recus/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Télécharger le PDF Cerfa"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-peach-pale transition-colors"
                      >
                        <Download className="size-3.5" /> PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Récap annuel par donateur */}
      {filtered.length > 1 && (
        <AnnualSummary receipts={filtered} year={filterYear} />
      )}

      {/* Note conformité */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        💡 <strong>Rappel :</strong> seul un <strong>don sans contrepartie</strong> ouvre droit au reçu —
        jamais une cotisation avec avantages, ni une billetterie. La qualité de l&apos;association et le
        signataire portés sur le Cerfa se règlent dans <strong>Paramètres → Facturation</strong>
        {rescritRef ? <> · Rescrit : <strong>{rescritRef}</strong></> : null}.
      </div>
    </div>
  );
}

// ── Récapitulatif annuel par donateur ─────────────────────────────────────────
function AnnualSummary({ receipts, year }: { receipts: TaxReceipt[]; year: string }) {
  const [open, setOpen] = useState(false);

  const byDonor = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of receipts) {
      const e = map.get(r.donor_name);
      if (e) { e.total += Number(r.amount); e.count++; }
      else map.set(r.donor_name, { total: Number(r.amount), count: 1 });
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [receipts]);

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <FileText className="size-4 text-warmgray" />
          Récapitulatif annuel par donateur {year && `— ${year}`}
        </div>
        <ChevronDown className={`size-4 text-warmgray transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-peach-pale">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-warmgray">Donateur</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-warmgray">Reçus</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-warmgray">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byDonor.map((d) => (
                <tr key={d.name} className="hover:bg-peach-pale/40">
                  <td className="px-5 py-2.5 font-semibold text-ink">{d.name}</td>
                  <td className="px-5 py-2.5 text-center text-warmgray">{d.count}</td>
                  <td className="px-5 py-2.5 text-right font-bold text-ink">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
