"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Pencil, Trash2, BellRing, CalendarClock, AlarmClock, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  CONTRACT_TYPES, CONTRACT_PERIODS, CONTRACT_STATUSES,
  contractTypeLabel, contractTypeEmoji, contractStatusLabel, contractStatusBadge,
  periodLabel, fmtEuros, fmtDate, annualCost, daysUntilDeadline,
} from "@/lib/contracts-meta";
import {
  saveContract, deleteContract, createRenewalTask, sendRenewalReminders,
  type ContractInput,
} from "@/app/(admin)/dashboard/[org]/contrats/actions";
import type { Contract, Person, Pole, ContractType, ContractPeriod, ContractStatus } from "@/lib/types";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

// ── Formulaire ───────────────────────────────────────────────────
function ContractForm({
  orgId, orgSlug, persons, poles, documents, initial, contractId, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; persons: Person[]; poles: Pole[]; documents: { id: string; title: string }[];
  initial?: Partial<ContractInput>; contractId?: string; onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<string>(initial?.contract_type ?? "autre");
  const [partyName, setPartyName] = useState(initial?.counterparty_name ?? "");
  const [personId, setPersonId] = useState(initial?.counterparty_person_id ?? "");
  const [poleId, setPoleId] = useState(initial?.pole_id ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [period, setPeriod] = useState<string>(initial?.amount_period ?? "annuel");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [renewalDate, setRenewalDate] = useState(initial?.renewal_date ?? "");
  const [autoRenew, setAutoRenew] = useState(initial?.auto_renew ?? false);
  const [noticeDays, setNoticeDays] = useState(initial?.notice_period_days != null ? String(initial.notice_period_days) : "");
  const [status, setStatus] = useState<string>(initial?.status ?? "actif");
  const [documentId, setDocumentId] = useState(initial?.document_id ?? "");
  const [signed, setSigned] = useState(initial?.signed ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, start] = useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Le titre est obligatoire."); return; }
    const input: ContractInput = {
      title: title.trim(),
      contract_type: type as ContractType,
      counterparty_name: partyName.trim() || null,
      counterparty_person_id: personId || null,
      pole_id: poleId || null,
      amount: amount ? parseFloat(amount.replace(",", ".")) : null,
      amount_period: period as ContractPeriod,
      start_date: startDate || null,
      end_date: endDate || null,
      renewal_date: renewalDate || null,
      auto_renew: autoRenew,
      notice_period_days: noticeDays ? parseInt(noticeDays, 10) : null,
      status: status as ContractStatus,
      document_id: documentId || null,
      signed,
      notes: notes.trim() || null,
    };
    start(async () => {
      const res = await saveContract(orgId, orgSlug, input, contractId);
      if (res.ok) { toast.success(contractId ? "Contrat mis à jour" : "Contrat créé"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{contractId ? "Modifier le contrat" : "Nouveau contrat"}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Intitulé *</label>
          <input className={inputCls} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assurance RC Pro, Bail commercial, Convention Ville…" />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Statut</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {CONTRACT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Contrepartie (nom)</label>
          <input className={inputCls} value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="MAIF, Mairie, SARL…" />
        </div>
        <div>
          <label className={labelCls}>Fiche CRM liée</label>
          <select className={inputCls} value={personId} onChange={(e) => {
            setPersonId(e.target.value);
            const p = persons.find((x) => x.id === e.target.value);
            if (p && !partyName) setPartyName(p.name);
          }}>
            <option value="">— Aucune —</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Montant (€)</label>
          <div className="flex gap-2">
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            <select className={`${inputCls} w-32`} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {CONTRACT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Pôle / Activité</label>
          <select className={inputCls} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
            <option value="">— Aucun —</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Début</label>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Fin d&apos;engagement</label>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Renouvellement / échéance</label>
          <input type="date" className={inputCls} value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Préavis (jours)</label>
          <input className={inputCls} inputMode="numeric" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} placeholder="ex. 60" />
        </div>
        <div>
          <label className={labelCls}>Document lié</label>
          <select className={inputCls} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
            <option value="">— Aucun —</option>
            {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} /> Tacite reconduction
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} /> Signé
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Références, conditions particulières…" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "…" : contractId ? "Enregistrer" : "Créer le contrat"}</button>
      </div>
    </div>
  );
}

// ── Modale rappel groupé ─────────────────────────────────────────
function ReminderModal({
  orgId, orgSlug, contracts, onClose,
}: {
  orgId: string; orgSlug: string; contracts: Contract[]; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(contracts.map((c) => c.id)));
  const [message, setMessage] = useState("Nous souhaitons faire le point sur le renouvellement de ce contrat. Pouvez-vous nous indiquer vos disponibilités ?");
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function send() {
    if (selected.size === 0) { toast.error("Sélectionnez au moins un contrat."); return; }
    start(async () => {
      const res = await sendRenewalReminders(orgId, orgSlug, Array.from(selected), message);
      if (res.ok) { toast.success(`Rappel envoyé (${res.sent ?? 0}) ✓`); onClose(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Rappel d&apos;échéance aux contreparties</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-[13px] text-warmgray">Seules les contreparties ayant une fiche CRM avec email seront jointes.</p>
        <div className="mb-3 max-h-44 overflow-y-auto rounded-xl border border-border">
          {contracts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-[13px] last:border-0">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="font-semibold text-ink">{c.title}</span>
              <span className="text-warmgray">{c.counterparty_name ?? "—"}</span>
            </label>
          ))}
        </div>
        <label className={labelCls}>Message</label>
        <textarea className={`${inputCls} min-h-[100px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
          <button onClick={send} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "Envoi…" : "Envoyer les rappels"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────────
export function ContractsView({ contracts, persons, poles, documents, orgSlug, orgId }: {
  contracts: Contract[]; persons: Person[]; poles: Pole[]; documents: { id: string; title: string }[]; orgSlug: string; orgId: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [, start] = useTransition();

  const kpis = useMemo(() => {
    const active = contracts.filter((c) => c.status === "actif");
    const fixedAnnual = active.reduce((s, c) => s + annualCost(c.amount, c.amount_period), 0);
    const soon = contracts.filter((c) => {
      const d = daysUntilDeadline(c);
      return d != null && d >= 0 && d <= 30;
    }).length;
    const toRenew = contracts.filter((c) => {
      const d = daysUntilDeadline(c);
      return d != null && d <= 60 && c.status === "actif";
    }).length;
    return { active: active.length, fixedAnnual, soon, toRenew };
  }, [contracts]);

  // Échéances à venir (≤60 j), triées par proximité
  const deadlines = useMemo(() => {
    return contracts
      .map((c) => ({ c, d: daysUntilDeadline(c) }))
      .filter((x) => x.d != null && x.d <= 60 && x.c.status !== "resilie")
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  }, [contracts]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return contracts;
    return contracts.filter((c) => c.contract_type === typeFilter);
  }, [contracts, typeFilter]);

  function remove(c: Contract) {
    if (!confirm(`Supprimer le contrat « ${c.title} » ?`)) return;
    start(async () => {
      const res = await deleteContract(orgSlug, c.id);
      if (res.ok) toast.success("Contrat supprimé"); else toast.error(res.error ?? "Erreur");
    });
  }
  function makeTask(c: Contract) {
    start(async () => {
      const res = await createRenewalTask(orgId, orgSlug, c.id);
      if (res.ok) toast.success("Tâche de suivi créée ✓"); else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Contrats actifs", value: String(kpis.active) },
          { label: "Charges fixes / an", value: fmtEuros(kpis.fixedAnnual) },
          { label: "Échéances < 30 j", value: String(kpis.soon), color: kpis.soon ? "#c2410c" : undefined },
          { label: "À renouveler < 60 j", value: String(kpis.toRenew), color: kpis.toRenew ? "#a06800" : undefined },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: k.color ?? "#2c2c2c" }}>{k.value}</div>
            <div className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Bandeau échéances */}
      {deadlines.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-orange-700">
            <AlarmClock className="size-3.5" /> Échéances à venir
          </div>
          <div className="flex flex-col gap-2">
            {deadlines.map(({ c, d }) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-ink">{contractTypeEmoji(c.contract_type)} {c.title}</span>
                {c.counterparty_name && <span className="text-warmgray">· {c.counterparty_name}</span>}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  (d ?? 0) < 0 ? "bg-red-100 text-red-700" : (d ?? 0) <= 15 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {(d ?? 0) < 0 ? `Dépassée de ${Math.abs(d ?? 0)} j` : (d ?? 0) === 0 ? "Aujourd'hui" : `Dans ${d} j`}
                </span>
                <button onClick={() => makeTask(c)} className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-[11px] font-semibold text-orange-700 hover:border-orange-400" title="Créer une tâche de suivi">
                  + Tâche
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setReminderOpen(true)} className="mc-btn mc-btn-outline mc-btn-sm mt-3">
            <BellRing className="size-3.5" /> Rappel groupé aux contreparties
          </button>
        </div>
      )}

      {/* Actions + filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mc-btn mc-btn-lime mc-btn-sm ml-auto">
          <Plus className="size-3.5" /> Nouveau contrat
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypeFilter("all")}
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${typeFilter === "all" ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
          Tous
        </button>
        {CONTRACT_TYPES.map((c) => (
          <button key={c.value} onClick={() => setTypeFilter(typeFilter === c.value ? "all" : c.value)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${typeFilter === c.value ? "border-coral/60 bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/30"}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {formOpen && (
        <ContractForm
          orgId={orgId} orgSlug={orgSlug} persons={persons} poles={poles} documents={documents}
          initial={editing ? {
            title: editing.title, contract_type: editing.contract_type,
            counterparty_name: editing.counterparty_name, counterparty_person_id: editing.counterparty_person_id,
            pole_id: editing.pole_id, amount: editing.amount, amount_period: editing.amount_period,
            start_date: editing.start_date, end_date: editing.end_date, renewal_date: editing.renewal_date,
            auto_renew: editing.auto_renew, notice_period_days: editing.notice_period_days,
            status: editing.status, document_id: editing.document_id, signed: editing.signed, notes: editing.notes,
          } : undefined}
          contractId={editing?.id}
          onDone={() => { setFormOpen(false); setEditing(null); }}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
          <CalendarClock className="mx-auto mb-3 size-8 text-warmgray/50" />
          <p className="text-sm text-warmgray">Aucun contrat enregistré.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.6fr_auto] gap-3 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span>Contrat</span><span>Contrepartie</span><span>Montant</span><span>Échéance</span><span>Statut</span><span></span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const d = daysUntilDeadline(c);
              const pole = c.pole_id ? poles.find((p) => p.id === c.pole_id) : null;
              return (
                <li key={c.id} className="grid grid-cols-1 gap-1.5 px-5 py-3.5 md:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.6fr_auto] md:items-center md:gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <span>{contractTypeEmoji(c.contract_type)}</span>{c.title}
                      {c.signed && <CheckCircle2 className="size-3.5 text-green-600" />}
                    </div>
                    <div className="text-[11px] text-warmgray">
                      {contractTypeLabel(c.contract_type)}{pole ? ` · ${pole.name}` : ""}
                    </div>
                  </div>
                  <span className="text-[12px] text-warmgray">{c.counterparty_name ?? "—"}</span>
                  <span className="text-[12px] text-ink">{c.amount != null ? `${fmtEuros(c.amount)} ${periodLabel(c.amount_period)}` : "—"}</span>
                  <div>
                    <div className="text-[12px] text-ink">{fmtDate(c.renewal_date ?? c.end_date)}</div>
                    {d != null && d <= 60 && c.status !== "resilie" && (
                      <div className={`text-[10px] font-bold uppercase ${d < 0 ? "text-red-600" : "text-orange-600"}`}>
                        {d < 0 ? "échue" : `dans ${d} j`}
                      </div>
                    )}
                  </div>
                  <span className={`mc-badge ${contractStatusBadge(c.status)} w-fit`}>{contractStatusLabel(c.status)}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => makeTask(c)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40" title="Créer une tâche de suivi">
                      <AlarmClock className="size-3.5" />
                    </button>
                    <button onClick={() => { setEditing(c); setFormOpen(true); }} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => remove(c)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reminderOpen && (
        <ReminderModal orgId={orgId} orgSlug={orgSlug} contracts={deadlines.map((x) => x.c)} onClose={() => setReminderOpen(false)} />
      )}
    </div>
  );
}
