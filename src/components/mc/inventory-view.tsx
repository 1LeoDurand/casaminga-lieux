"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Pencil, Trash2, Upload, Loader2, Package, Wrench, HandHelping, Undo2, BellRing, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, MAINTENANCE_STATUSES,
  categoryLabel, categoryEmoji, assetStatusLabel, assetStatusBadge, conditionLabel,
  fmtEuros, fmtDate, daysUntilWarranty,
} from "@/lib/inventory-meta";
import {
  saveAsset, deleteAsset, lendAsset, returnAsset, sendReturnReminders,
  saveMaintenance, deleteMaintenance, maintenanceToExpense,
  type AssetInput, type MaintenanceInput,
} from "@/app/(admin)/dashboard/[org]/inventaire/actions";
import type {
  Asset, AssetMaintenance, Person, Pole, AssetCategory, AssetStatus, AssetCondition, MaintenanceStatus,
} from "@/lib/types";

const inputCls = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── Formulaire bien ──────────────────────────────────────────────
function AssetForm({
  orgId, orgSlug, poles, initial, assetId, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; poles: Pole[];
  initial?: Partial<AssetInput>; assetId?: string; onDone: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "autre");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [poleId, setPoleId] = useState(initial?.pole_id ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "disponible");
  const [condition, setCondition] = useState<string>(initial?.condition ?? "bon");
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : "1");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? "");
  const [purchaseValue, setPurchaseValue] = useState(initial?.purchase_value != null ? String(initial.purchase_value) : "");
  const [warrantyUntil, setWarrantyUntil] = useState(initial?.warranty_until ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `org/${orgId}/assets/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("public-assets").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast.success("Photo chargée ✓");
    } catch (err) {
      toast.error(`Erreur upload : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!name.trim()) { toast.error("Le nom est obligatoire."); return; }
    const input: AssetInput = {
      name: name.trim(),
      category: category as AssetCategory,
      reference: reference.trim() || null,
      location: location.trim() || null,
      pole_id: poleId || null,
      status: status as AssetStatus,
      condition: condition as AssetCondition,
      quantity: parseInt(quantity, 10) || 1,
      purchase_date: purchaseDate || null,
      purchase_value: purchaseValue ? parseFloat(purchaseValue.replace(",", ".")) : null,
      warranty_until: warrantyUntil || null,
      photo_url: photoUrl || null,
      notes: notes.trim() || null,
    };
    start(async () => {
      const res = await saveAsset(orgId, orgSlug, input, assetId);
      if (res.ok) { toast.success(assetId ? "Bien mis à jour" : "Bien ajouté"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{assetId ? "Modifier le bien" : "Nouveau bien"}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Désignation *</label>
          <input className={inputCls} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vidéoprojecteur Epson, Perceuse Bosch…" />
        </div>
        <div>
          <label className={labelCls}>Catégorie</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Quantité</label>
          <input className={inputCls} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Référence / n° série</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Emplacement</label>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Atelier, Régie, Réserve…" />
        </div>
        <div>
          <label className={labelCls}>État</label>
          <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value)}>
            {ASSET_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Statut</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {ASSET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Pôle</label>
          <select className={inputCls} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
            <option value="">— Aucun —</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Valeur d&apos;achat (€)</label>
          <input className={inputCls} inputMode="decimal" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Date d&apos;achat</label>
          <input type="date" className={inputCls} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Garantie jusqu&apos;au</label>
          <input type="date" className={inputCls} value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Photo</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-white px-4 py-3 transition-colors hover:border-coral/60">
            {uploading ? <Loader2 className="size-4 animate-spin text-coral" /> : <Upload className="size-4 text-warmgray" />}
            <span className="text-[13px] text-warmgray">{uploading ? "Upload…" : photoUrl ? "✓ Photo chargée — cliquer pour remplacer" : "Cliquer pour uploader une photo"}</span>
            <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending || uploading}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || uploading}>{pending ? "…" : assetId ? "Enregistrer" : "Ajouter le bien"}</button>
      </div>
    </div>
  );
}

// ── Modale prêt ──────────────────────────────────────────────────
function LendModal({ orgSlug, asset, persons, onClose }: {
  orgSlug: string; asset: Asset; persons: Person[]; onClose: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [pending, start] = useTransition();
  function lend() {
    if (!personId) { toast.error("Choisissez une personne."); return; }
    start(async () => {
      const res = await lendAsset(orgSlug, asset.id, personId);
      if (res.ok) { toast.success("Prêt enregistré ✓"); onClose(); } else toast.error(res.error ?? "Erreur");
    });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Prêter « {asset.name} »</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <label className={labelCls}>Prêter à</label>
        <select className={inputCls} value={personId} onChange={(e) => setPersonId(e.target.value)}>
          <option value="">— Choisir une personne —</option>
          {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
          <button onClick={lend} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "…" : "Enregistrer le prêt"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modale rappel retour ─────────────────────────────────────────
function ReturnReminderModal({ orgId, orgSlug, onClose }: { orgId: string; orgSlug: string; onClose: () => void }) {
  const [message, setMessage] = useState("Pourrais-tu rapporter le matériel emprunté au lieu ? Merci !");
  const [pending, start] = useTransition();
  function send() {
    start(async () => {
      const res = await sendReturnReminders(orgId, orgSlug, message);
      if (res.ok) { toast.success(`Rappel envoyé (${res.sent ?? 0}) ✓`); onClose(); } else toast.error(res.error ?? "Erreur");
    });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">Rappel de retour aux détenteurs</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-[13px] text-warmgray">Chaque détenteur reçoit la liste du matériel qu&apos;il a en prêt.</p>
        <label className={labelCls}>Message</label>
        <textarea className={`${inputCls} min-h-[100px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
          <button onClick={send} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "Envoi…" : "Envoyer"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire maintenance ───────────────────────────────────────
function MaintenanceForm({ orgId, orgSlug, assets, persons, initial, mId, onDone, onCancel }: {
  orgId: string; orgSlug: string; assets: Asset[]; persons: Person[];
  initial?: Partial<MaintenanceInput>; mId?: string; onDone: () => void; onCancel: () => void;
}) {
  const [assetId, setAssetId] = useState(initial?.asset_id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "a_faire");
  const [reportedAt, setReportedAt] = useState(initial?.reported_at ?? todayISO());
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [assignee, setAssignee] = useState(initial?.assignee_person_id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Le titre est obligatoire."); return; }
    const input: MaintenanceInput = {
      asset_id: assetId || null,
      title: title.trim(),
      description: description.trim() || null,
      status: status as MaintenanceStatus,
      reported_at: reportedAt,
      due_date: dueDate || null,
      done_at: null,
      cost: cost ? parseFloat(cost.replace(",", ".")) : null,
      assignee_person_id: assignee || null,
    };
    start(async () => {
      const res = await saveMaintenance(orgId, orgSlug, input, mId);
      if (res.ok) { toast.success(mId ? "Ticket mis à jour" : "Ticket créé"); onDone(); } else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-peach-pale p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{mId ? "Modifier le ticket" : "Nouveau ticket de maintenance"}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Intitulé *</label>
          <input className={inputCls} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réparer la sono, Révision chaudière…" />
        </div>
        <div>
          <label className={labelCls}>Bien concerné</label>
          <select className={inputCls} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">— Travaux général —</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Statut</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {MAINTENANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Signalé le</label>
          <input type="date" className={inputCls} value={reportedAt} onChange={(e) => setReportedAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Échéance</label>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Coût estimé (€)</label>
          <input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Assigné à</label>
          <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">— Personne —</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>Annuler</button>
        <button onClick={submit} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}>{pending ? "…" : mId ? "Enregistrer" : "Créer le ticket"}</button>
      </div>
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────────
export function InventoryView({ assets, maintenance, persons, poles, orgSlug, orgId }: {
  assets: Asset[]; maintenance: AssetMaintenance[]; persons: Person[]; poles: Pole[]; orgSlug: string; orgId: string;
}) {
  const [tab, setTab] = useState<"inventaire" | "maintenance">("inventaire");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [lendAssetObj, setLendAssetObj] = useState<Asset | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [mFormOpen, setMFormOpen] = useState(false);
  const [editingM, setEditingM] = useState<AssetMaintenance | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [, start] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const kpis = useMemo(() => {
    const value = assets.reduce((s, a) => s + (a.purchase_value ?? 0) * a.quantity, 0);
    const broken = assets.filter((a) => a.status === "en_panne").length;
    const lent = assets.filter((a) => a.status === "en_pret").length;
    const warrantySoon = assets.filter((a) => {
      const d = daysUntilWarranty(a.warranty_until);
      return d != null && d >= 0 && d <= 30;
    }).length;
    return { count: assets.length, value, broken, lent, warrantySoon };
  }, [assets]);

  const filtered = useMemo(() => {
    let list = assets;
    if (catFilter !== "all") list = list.filter((a) => a.category === catFilter);
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    return list;
  }, [assets, catFilter, statusFilter]);

  function removeAsset(a: Asset) {
    if (!confirm(`Supprimer « ${a.name} » ?`)) return;
    start(async () => {
      const res = await deleteAsset(orgSlug, a.id);
      if (res.ok) toast.success("Bien supprimé"); else toast.error(res.error ?? "Erreur");
    });
  }
  function doReturn(a: Asset) {
    start(async () => {
      const res = await returnAsset(orgSlug, a.id);
      if (res.ok) toast.success("Retour enregistré ✓"); else toast.error(res.error ?? "Erreur");
    });
  }
  function removeM(m: AssetMaintenance) {
    if (!confirm("Supprimer ce ticket ?")) return;
    start(async () => {
      const res = await deleteMaintenance(orgSlug, m.id);
      if (res.ok) toast.success("Ticket supprimé"); else toast.error(res.error ?? "Erreur");
    });
  }
  function toExpense(m: AssetMaintenance) {
    start(async () => {
      const res = await maintenanceToExpense(orgId, orgSlug, m.id);
      if (res.ok) toast.success("Dépense créée ✓ (module Dépenses)"); else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Biens", value: String(kpis.count) },
          { label: "Valeur du parc", value: fmtEuros(kpis.value) },
          { label: "En prêt", value: String(kpis.lent), color: kpis.lent ? "#a06800" : undefined },
          { label: "En panne", value: String(kpis.broken), color: kpis.broken ? "#c2410c" : undefined },
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
          {(["inventaire", "maintenance"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-colors ${tab === t ? "bg-coral text-white" : "text-warmgray hover:bg-peach-pale"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {tab === "inventaire" && (
            <>
              {kpis.lent > 0 && (
                <button onClick={() => setReminderOpen(true)} className="mc-btn mc-btn-outline mc-btn-sm">
                  <BellRing className="size-3.5" /> Rappel retour
                </button>
              )}
              <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mc-btn mc-btn-lime mc-btn-sm">
                <Plus className="size-3.5" /> Ajouter un bien
              </button>
            </>
          )}
          {tab === "maintenance" && (
            <button onClick={() => { setEditingM(null); setMFormOpen(true); }} className="mc-btn mc-btn-lime mc-btn-sm">
              <Plus className="size-3.5" /> Nouveau ticket
            </button>
          )}
        </div>
      </div>

      {/* ── Onglet INVENTAIRE ── */}
      {tab === "inventaire" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter("all")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${statusFilter === "all" ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
              Tous statuts
            </button>
            {ASSET_STATUSES.map((s) => (
              <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${statusFilter === s.value ? "border-coral/60 bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/30"}`}>
                {s.label}
              </button>
            ))}
            <span className="mx-1 self-center text-warmgray/40">|</span>
            {ASSET_CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setCatFilter(catFilter === c.value ? "all" : c.value)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${catFilter === c.value ? "border-coral/60 bg-coral/10 text-coral-dark" : "border-border bg-white text-warmgray hover:border-coral/30"}`}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {formOpen && (
            <AssetForm
              orgId={orgId} orgSlug={orgSlug} poles={poles}
              initial={editing ? {
                name: editing.name, category: editing.category, reference: editing.reference,
                location: editing.location, pole_id: editing.pole_id, status: editing.status,
                condition: editing.condition, quantity: editing.quantity, purchase_date: editing.purchase_date,
                purchase_value: editing.purchase_value, warranty_until: editing.warranty_until,
                photo_url: editing.photo_url, notes: editing.notes,
              } : undefined}
              assetId={editing?.id}
              onDone={() => { setFormOpen(false); setEditing(null); }}
              onCancel={() => { setFormOpen(false); setEditing(null); }}
            />
          )}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
              <Package className="mx-auto mb-3 size-8 text-warmgray/50" />
              <p className="text-sm text-warmgray">Aucun bien dans l&apos;inventaire.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a) => {
                const holder = a.holder_person_id ? personById.get(a.holder_person_id) : null;
                const wd = daysUntilWarranty(a.warranty_until);
                return (
                  <div key={a.id} className="flex flex-col rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-start gap-3">
                      {a.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.photo_url} alt={a.name} className="size-14 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-cream text-2xl">{categoryEmoji(a.category)}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-bold text-ink">{a.name}</div>
                        <div className="text-[11px] text-warmgray">
                          {categoryLabel(a.category)}{a.quantity > 1 ? ` ×${a.quantity}` : ""}{a.location ? ` · ${a.location}` : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`mc-badge ${assetStatusBadge(a.status)}`}>{assetStatusLabel(a.status)}</span>
                          <span className="text-[11px] text-warmgray">{conditionLabel(a.condition)}</span>
                        </div>
                      </div>
                    </div>

                    {holder && (
                      <div className="mt-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[12px] text-orange-700">
                        Prêté à <strong>{holder.name}</strong>
                      </div>
                    )}
                    {wd != null && wd >= 0 && wd <= 30 && (
                      <div className="mt-2 text-[11px] font-semibold text-amber-700">⚠️ Garantie expire dans {wd} j</div>
                    )}
                    {a.purchase_value != null && (
                      <div className="mt-2 text-[12px] text-warmgray">Valeur : {fmtEuros(a.purchase_value)}</div>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3">
                      {a.status === "en_pret" ? (
                        <button onClick={() => doReturn(a)} className="mc-btn mc-btn-outline mc-btn-sm">
                          <Undo2 className="size-3.5" /> Retour
                        </button>
                      ) : a.status === "disponible" ? (
                        <button onClick={() => setLendAssetObj(a)} className="mc-btn mc-btn-outline mc-btn-sm">
                          <HandHelping className="size-3.5" /> Prêter
                        </button>
                      ) : null}
                      <button onClick={() => { setEditing(a); setFormOpen(true); }} className="ml-auto rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => removeAsset(a)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Onglet MAINTENANCE ── */}
      {tab === "maintenance" && (
        <>
          {mFormOpen && (
            <MaintenanceForm
              orgId={orgId} orgSlug={orgSlug} assets={assets} persons={persons}
              initial={editingM ? {
                asset_id: editingM.asset_id, title: editingM.title, description: editingM.description,
                status: editingM.status, reported_at: editingM.reported_at, due_date: editingM.due_date,
                cost: editingM.cost, assignee_person_id: editingM.assignee_person_id,
              } : undefined}
              mId={editingM?.id}
              onDone={() => { setMFormOpen(false); setEditingM(null); }}
              onCancel={() => { setMFormOpen(false); setEditingM(null); }}
            />
          )}
          {maintenance.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
              <Wrench className="mx-auto mb-3 size-8 text-warmgray/50" />
              <p className="text-sm text-warmgray">Aucun ticket de maintenance.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <ul className="divide-y divide-border">
                {maintenance.map((m) => {
                  const asset = m.asset_id ? assetById.get(m.asset_id) : null;
                  const st = MAINTENANCE_STATUSES.find((s) => s.value === m.status);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: st?.dot ?? "#999" }} title={st?.label} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">{m.title}</div>
                        <div className="text-[11px] text-warmgray">
                          {asset ? asset.name : "Travaux général"} · signalé {fmtDate(m.reported_at)}{m.due_date ? ` · échéance ${fmtDate(m.due_date)}` : ""}
                        </div>
                      </div>
                      {m.cost != null && <span className="text-[12px] font-semibold text-ink">{fmtEuros(m.cost)}</span>}
                      <div className="flex items-center gap-1.5">
                        {m.cost != null && m.cost > 0 && (
                          <button onClick={() => toExpense(m)} disabled={!!m.expense_id}
                            className={`rounded-lg border p-1.5 ${m.expense_id ? "border-green-200 text-green-600" : "border-border text-warmgray hover:border-coral/40"}`}
                            title={m.expense_id ? "Dépense déjà créée" : "Créer la dépense"}>
                            <Receipt className="size-3.5" />
                          </button>
                        )}
                        <button onClick={() => { setEditingM(m); setMFormOpen(true); }} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => removeM(m)} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600">
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

      {lendAssetObj && <LendModal orgSlug={orgSlug} asset={lendAssetObj} persons={persons} onClose={() => setLendAssetObj(null)} />}
      {reminderOpen && <ReturnReminderModal orgId={orgId} orgSlug={orgSlug} onClose={() => setReminderOpen(false)} />}
    </div>
  );
}
