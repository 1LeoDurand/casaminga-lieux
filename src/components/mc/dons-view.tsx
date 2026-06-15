"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Pencil, Trash2, Mail, HeartHandshake, Receipt, Target, X } from "lucide-react";
import { toast } from "sonner";
import {
  DONATION_TYPES, CAMPAIGN_STATUSES, donationTypeLabel, donationTypeEmoji,
  campaignStatusLabel, fmtEuros, fmtDate, slugifyCampaign,
} from "@/lib/donations-meta";
import {
  saveDonation, deleteDonation, issueDonationReceipt,
  saveDonationCampaign, deleteDonationCampaign, sendDonorsEmail,
  type DonationInput, type DonationCampaignInput,
} from "@/app/(admin)/dashboard/[org]/dons/actions";
import type { Donation, DonationCampaign, Person, Pole } from "@/lib/types";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── Formulaire don ───────────────────────────────────────────────
function DonationForm({
  orgId, orgSlug, persons, poles, campaigns, initial, donationId, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; persons: Person[]; poles: Pole[]; campaigns: DonationCampaign[];
  initial?: Partial<DonationInput>; donationId?: string; onDone: () => void; onCancel: () => void;
}) {
  const [donorName, setDonorName] = useState(initial?.donor_name ?? "");
  const [personId, setPersonId] = useState(initial?.donor_person_id ?? "");
  const [email, setEmail] = useState(initial?.donor_email ?? "");
  const [address, setAddress] = useState(initial?.donor_address ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [type, setType] = useState<string>(initial?.donation_type ?? "ponctuel");
  const [receivedAt, setReceivedAt] = useState(initial?.received_at ?? todayISO());
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? "");
  const [paymentStatus, setPaymentStatus] = useState<string>(initial?.payment_status ?? "confirme");
  const [campaignId, setCampaignId] = useState(initial?.campaign_id ?? "");
  const [poleId, setPoleId] = useState(initial?.pole_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, start] = useTransition();

  function submit() {
    if (!donorName.trim()) { toast.error("Le nom du donateur est obligatoire."); return; }
    const a = parseFloat(amount.replace(",", "."));
    if (isNaN(a) || a <= 0) { toast.error("Montant invalide."); return; }
    const input: DonationInput = {
      donor_name: donorName.trim(),
      donor_person_id: personId || null,
      donor_email: email.trim() || null,
      donor_address: address.trim() || null,
      amount: a,
      donation_type: type as DonationInput["donation_type"],
      received_at: receivedAt,
      payment_method: paymentMethod || null,
      payment_status: paymentStatus as DonationInput["payment_status"],
      campaign_id: campaignId || null,
      pole_id: poleId || null,
      notes: notes.trim() || null,
    };
    start(async () => {
      const res = await saveDonation(orgId, orgSlug, input, donationId);
      if (res.ok) { toast.success(donationId ? "Don mis à jour" : "Don enregistré ✓ — recette ajoutée aux Finances"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{donationId ? "Modifier le don" : "Enregistrer un don"}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Donateur *</label>
          <input className={inputCls} autoFocus value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Nom du donateur ou de l'entreprise" />
        </div>
        <div>
          <label className={labelCls}>Fiche CRM (optionnel)</label>
          <select className={inputCls} value={personId} onChange={(e) => {
            setPersonId(e.target.value);
            const p = persons.find((x) => x.id === e.target.value);
            if (p) { setDonorName(p.name); if (p.email) setEmail(p.email); }
          }}>
            <option value="">— Aucune / nouveau —</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Email (pour le reçu + mails)</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="donateur@exemple.fr" />
        </div>
        <div>
          <label className={labelCls}>Adresse (reçu fiscal Cerfa)</label>
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue… 75000 Ville" />
        </div>
        <div>
          <label className={labelCls}>Montant (€) *</label>
          <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Type de don</label>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {DONATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date de réception</label>
          <input type="date" className={inputCls} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Statut</label>
          <select className={inputCls} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="confirme">✅ Confirmé (recette créée)</option>
            <option value="en_attente">⏳ En attente (promesse)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Mode de règlement</label>
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">— Non précisé —</option>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="especes">Espèces</option>
            <option value="cb">Carte bancaire</option>
            <option value="en_ligne">En ligne</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Campagne</label>
          <select className={inputCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">— Hors campagne —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Pôle / Activité</label>
          <select className={inputCls} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
            <option value="">— Aucun —</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Précisions…" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>
          {pending ? "…" : donationId ? "Enregistrer" : "Enregistrer le don"}
        </button>
      </div>
    </div>
  );
}

// ── Formulaire campagne ──────────────────────────────────────────
function CampaignForm({
  orgId, orgSlug, initial, campaignId, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; initial?: Partial<DonationCampaignInput>; campaignId?: string;
  onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goal, setGoal] = useState(initial?.goal_amount != null ? String(initial.goal_amount) : "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "active");
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);
  const [pending, start] = useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Le titre est obligatoire."); return; }
    const input: DonationCampaignInput = {
      title: title.trim(),
      slug: slugifyCampaign(title),
      description: description.trim() || null,
      goal_amount: goal ? parseFloat(goal.replace(",", ".")) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: status as DonationCampaignInput["status"],
      is_public: isPublic,
    };
    start(async () => {
      const res = await saveDonationCampaign(orgId, orgSlug, input, campaignId);
      if (res.ok) { toast.success(campaignId ? "Campagne mise à jour" : "Campagne créée"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{campaignId ? "Modifier la campagne" : "Nouvelle campagne de dons"}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Titre *</label>
          <input className={inputCls} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aidez-nous à rénover l'atelier" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="À quoi serviront les dons…" />
        </div>
        <div>
          <label className={labelCls}>Objectif (€)</label>
          <input className={inputCls} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="5000" />
        </div>
        <div>
          <label className={labelCls}>Statut</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {CAMPAIGN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Début</label>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Fin</label>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Visible sur le site public (page « Soutenir »)
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "…" : campaignId ? "Enregistrer" : "Créer la campagne"}</button>
      </div>
    </div>
  );
}

// ── Modale mail groupé ───────────────────────────────────────────
function GroupEmailModal({
  orgId, orgSlug, campaigns, recipientCount, onClose,
}: {
  orgId: string; orgSlug: string; campaigns: DonationCampaign[]; recipientCount: number; onClose: () => void;
}) {
  const [campaignId, setCampaignId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function send() {
    if (!subject.trim() || !message.trim()) { toast.error("Sujet et message obligatoires."); return; }
    start(async () => {
      const res = await sendDonorsEmail(orgId, orgSlug, {
        campaignId: campaignId || null, subject, message,
      });
      if (res.ok) { toast.success(`Email envoyé à ${res.sent ?? 0} donateur·rice·s ✓`); onClose(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Mail groupé aux donateurs</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Cible</label>
            <select className={inputCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Tous les donateurs ({recipientCount})</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>Campagne : {c.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sujet</label>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Merci pour votre soutien 🙏" />
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea className={`${inputCls} min-h-[140px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bonjour,&#10;&#10;Grâce à vous…" />
          </div>
          <p className="text-[12px] text-warmgray">Chaque donateur reçoit l&apos;email individuellement (pas de copie visible). Journalisé.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
          <button onClick={send} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "Envoi…" : "Envoyer"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────────
export function DonsView({ donations, campaigns, persons, poles, orgSlug, orgId }: {
  donations: Donation[]; campaigns: DonationCampaign[]; persons: Person[]; poles: Pole[]; orgSlug: string; orgId: string;
}) {
  const [tab, setTab] = useState<"dons" | "campagnes">("dons");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [campFormOpen, setCampFormOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<DonationCampaign | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [, start] = useTransition();

  const poleById = useMemo(() => new Map(poles.map((p) => [p.id, p])), [poles]);
  const campById = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);
  const year = new Date().getFullYear();

  const kpis = useMemo(() => {
    const confirmed = donations.filter((d) => d.payment_status === "confirme");
    const thisYear = confirmed.filter((d) => new Date(d.received_at).getFullYear() === year);
    const total = thisYear.reduce((s, d) => s + d.amount, 0);
    const donors = new Set(donations.map((d) => d.donor_email || d.donor_name)).size;
    const recurring = donations.filter((d) => d.donation_type === "recurrent").length;
    const toIssue = confirmed.filter((d) => !d.tax_receipt_issued).length;
    return { total, donors, recurring, toIssue };
  }, [donations, year]);

  const recipientCount = useMemo(
    () => new Set(donations.map((d) => d.donor_email).filter((e) => e && e.includes("@"))).size,
    [donations]
  );

  const filtered = useMemo(() => {
    if (typeFilter === "all") return donations;
    return donations.filter((d) => d.donation_type === typeFilter);
  }, [donations, typeFilter]);

  function removeDonation(d: Donation) {
    if (!confirm(`Supprimer le don de « ${d.donor_name} » ? La recette liée sera retirée.`)) return;
    start(async () => {
      const res = await deleteDonation(orgSlug, d.id);
      if (res.ok) toast.success("Don supprimé"); else toast.error(res.error ?? "Erreur");
    });
  }
  function issueReceipt(d: Donation) {
    start(async () => {
      const res = await issueDonationReceipt(orgId, orgSlug, d.id);
      if (res.ok) {
        toast.success("Reçu fiscal Cerfa émis ✓ — ouverture du PDF");
        if (res.id) window.open(`/dashboard/${orgSlug}/factures/recus/${res.id}/pdf`, "_blank");
      } else toast.error(res.error ?? "Erreur");
    });
  }
  function removeCampaign(c: DonationCampaign) {
    if (!confirm(`Supprimer la campagne « ${c.title} » ?`)) return;
    start(async () => {
      const res = await deleteDonationCampaign(orgSlug, c.id);
      if (res.ok) toast.success("Campagne supprimée"); else toast.error(res.error ?? "Erreur");
    });
  }

  const collectedByCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of donations) {
      if (d.payment_status !== "confirme" || !d.campaign_id) continue;
      m.set(d.campaign_id, (m.get(d.campaign_id) ?? 0) + d.amount);
    }
    return m;
  }, [donations]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `Collecté ${year}`, value: fmtEuros(kpis.total), color: "#2f8a4c" },
          { label: "Donateurs", value: String(kpis.donors) },
          { label: "Dons récurrents", value: String(kpis.recurring) },
          { label: "Reçus à émettre", value: String(kpis.toIssue), color: kpis.toIssue ? "#c2410c" : undefined },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: k.color ?? "#2c2c2c" }}>{k.value}</div>
            <div className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
          {(["dons", "campagnes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-colors ${tab === t ? "bg-coral text-white" : "text-warmgray hover:bg-peach-pale"}`}>
              {t === "dons" ? "Dons" : "Campagnes"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {tab === "dons" && (
            <>
              <button onClick={() => setEmailOpen(true)} className="mc-btn mc-btn-outline mc-btn-sm" disabled={recipientCount === 0}>
                <Mail className="size-3.5" /> Mail groupé
              </button>
              <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mc-btn mc-btn-lime mc-btn-sm">
                <Plus className="size-3.5" /> Enregistrer un don
              </button>
            </>
          )}
          {tab === "campagnes" && (
            <button onClick={() => { setEditingCamp(null); setCampFormOpen(true); }} className="mc-btn mc-btn-lime mc-btn-sm">
              <Plus className="size-3.5" /> Nouvelle campagne
            </button>
          )}
        </div>
      </div>

      {/* ── Onglet DONS ── */}
      {tab === "dons" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTypeFilter("all")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${typeFilter === "all" ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
              Tous
            </button>
            {DONATION_TYPES.map((t) => (
              <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? "all" : t.value)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${typeFilter === t.value ? "border-coral/60 bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/30"}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {formOpen && (
            <DonationForm
              orgId={orgId} orgSlug={orgSlug} persons={persons} poles={poles} campaigns={campaigns}
              initial={editing ? {
                donor_name: editing.donor_name, donor_person_id: editing.donor_person_id,
                donor_email: editing.donor_email, donor_address: editing.donor_address,
                amount: editing.amount, donation_type: editing.donation_type,
                received_at: editing.received_at, payment_method: editing.payment_method,
                payment_status: editing.payment_status, campaign_id: editing.campaign_id,
                pole_id: editing.pole_id, notes: editing.notes,
              } : undefined}
              donationId={editing?.id}
              onDone={() => { setFormOpen(false); setEditing(null); }}
              onCancel={() => { setFormOpen(false); setEditing(null); }}
            />
          )}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
              <HeartHandshake className="mx-auto mb-3 size-8 text-warmgray/50" />
              <p className="text-sm text-warmgray">Aucun don enregistré.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="hidden grid-cols-[0.7fr_1.2fr_0.7fr_0.7fr_0.8fr_auto] gap-3 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
                <span>Date</span><span>Donateur</span><span>Montant</span><span>Type</span><span>Campagne</span><span></span>
              </div>
              <ul className="divide-y divide-border">
                {filtered.map((d) => {
                  const camp = d.campaign_id ? campById.get(d.campaign_id) : null;
                  const pending = d.payment_status === "en_attente";
                  return (
                    <li key={d.id} className="grid grid-cols-1 gap-1.5 px-5 py-3.5 md:grid-cols-[0.7fr_1.2fr_0.7fr_0.7fr_0.8fr_auto] md:items-center md:gap-3">
                      <span className="text-[12px] text-warmgray">{fmtDate(d.received_at)}</span>
                      <div>
                        <div className="text-[13px] font-semibold text-ink">{d.donor_name}</div>
                        {d.donor_email && <div className="text-[11px] text-warmgray">{d.donor_email}</div>}
                      </div>
                      <div>
                        <div className={`text-[13px] font-bold ${pending ? "text-warmgray" : "text-green-700"}`}>{fmtEuros(d.amount)}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-warmgray">
                          {pending ? "⏳ en attente" : "✅ confirmé"}
                        </div>
                      </div>
                      <span className="text-[12px] text-warmgray">{donationTypeEmoji(d.donation_type)} {donationTypeLabel(d.donation_type)}</span>
                      <span className="text-[12px] text-warmgray">{camp ? camp.title : "—"}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => issueReceipt(d)} disabled={d.tax_receipt_issued}
                          className={`rounded-lg border p-1.5 ${d.tax_receipt_issued ? "border-green-200 text-green-600" : "border-border text-warmgray hover:border-coral/40"}`}
                          title={d.tax_receipt_issued ? `Reçu émis (${d.tax_receipt_ref})` : "Émettre le reçu fiscal"}>
                          <Receipt className="size-3.5" />
                        </button>
                        <button onClick={() => { setEditing(d); setFormOpen(true); }} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => removeDonation(d)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ── Onglet CAMPAGNES ── */}
      {tab === "campagnes" && (
        <>
          {campFormOpen && (
            <CampaignForm
              orgId={orgId} orgSlug={orgSlug}
              initial={editingCamp ? {
                title: editingCamp.title, description: editingCamp.description,
                goal_amount: editingCamp.goal_amount, start_date: editingCamp.start_date,
                end_date: editingCamp.end_date, status: editingCamp.status, is_public: editingCamp.is_public,
              } : undefined}
              campaignId={editingCamp?.id}
              onDone={() => { setCampFormOpen(false); setEditingCamp(null); }}
              onCancel={() => { setCampFormOpen(false); setEditingCamp(null); }}
            />
          )}
          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
              <Target className="mx-auto mb-3 size-8 text-warmgray/50" />
              <p className="text-sm text-warmgray">Aucune campagne. Créez-en une pour collecter en ligne via la page « Soutenir ».</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {campaigns.map((c) => {
                const collected = collectedByCampaign.get(c.id) ?? 0;
                const pct = c.goal_amount ? Math.min(100, Math.round((collected / c.goal_amount) * 100)) : null;
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-white p-5">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-heading text-base font-bold text-ink">{c.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
                          <span>{campaignStatusLabel(c.status)}</span>
                          {c.is_public && <span className="text-coral-dark">• Public</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setEditingCamp(c); setCampFormOpen(true); }} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => removeCampaign(c)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {c.description && <p className="mb-3 text-[13px] text-warmgray">{c.description}</p>}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[15px] font-extrabold text-green-700">{fmtEuros(collected)}</span>
                      {c.goal_amount && <span className="text-[12px] text-warmgray">/ {fmtEuros(c.goal_amount)}</span>}
                    </div>
                    {pct != null && (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {c.is_public && (
                      <a href={`/site/${orgSlug}/soutenir`} target="_blank" rel="noopener noreferrer"
                        className="mt-3 inline-block text-[12px] font-semibold text-coral-dark hover:underline">
                        Voir sur le site public →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {emailOpen && (
        <GroupEmailModal orgId={orgId} orgSlug={orgSlug} campaigns={campaigns} recipientCount={recipientCount} onClose={() => setEmailOpen(false)} />
      )}
    </div>
  );
}
