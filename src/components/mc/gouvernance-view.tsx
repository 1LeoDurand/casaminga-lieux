"use client";
import { useMemo, useState, useTransition } from "react";
import { X, Plus, Pencil, Trash2, Gavel, Calendar, User, FileText, Check, Users, ArrowRight, ShieldCheck, Mail, Download, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  MEETING_TYPES, MEETING_STATUSES, meetingTypeShort, meetingTypeBadge,
  meetingStatusLabel, meetingStatusBadge, formatDateLong, mandatePeriod,
} from "@/lib/governance-meta";
import {
  createMeetingAction, updateMeetingAction, deleteMeetingAction,
  createMandateAction, updateMandateAction, deleteMandateAction,
  createProxyAction, deleteProxyAction, upsertAttendanceAction,
  createResolutionAction, updateResolutionAction, deleteResolutionAction,
  sendConvocationAction,
} from "@/app/(admin)/dashboard/[org]/gouvernance/actions";
import type { Mandate, Meeting, Person, AssemblyProxy, AssemblyAttendance, MeetingResolution } from "@/lib/types";

type Tab = "reunions" | "mandats";

// ── Modale Réunion ──
interface MeetingFV { type: Meeting["type"]; title: string; date: string; agenda: string; minutes: string; status: Meeting["status"]; }
function MeetingModal({ open, meeting, busy, onSubmit, onClose }: {
  open: boolean; meeting: Meeting | null; busy: boolean; onSubmit: (v: MeetingFV) => void; onClose: () => void;
}) {
  const [v, setV] = useState<MeetingFV>({
    type: meeting?.type ?? "bureau", title: meeting?.title ?? "", date: meeting?.date ?? "",
    agenda: meeting?.agenda ?? "", minutes: meeting?.minutes ?? "", status: meeting?.status ?? "planifiee",
  });
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof MeetingFV>(k: K, val: MeetingFV[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.title.trim()) { setError("Le titre est obligatoire."); return; }
    if (!v.date) { setError("La date est obligatoire."); return; }
    onSubmit({ ...v, title: v.title.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{meeting ? "Modifier la réunion" : "Nouvelle réunion"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
            <input className="mc-input" value={v.title} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="Conseil d'administration, AG ordinaire…" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Type</label>
              <select className="mc-input" value={v.type} onChange={(e) => set("type", e.target.value as Meeting["type"])}>
                {MEETING_TYPES.map((t) => <option key={t.value} value={t.value}>{meetingTypeShort(t.value)}</option>)}
              </select></div>
            <div className="mc-form-group"><label className="mc-form-label">Date</label>
              <input className="mc-input" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div className="mc-form-group"><label className="mc-form-label">Statut</label>
              <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as Meeting["status"])}>
                {MEETING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Ordre du jour</label>
            <textarea className="mc-textarea" value={v.agenda} onChange={(e) => set("agenda", e.target.value)} placeholder="1. ...\n2. ..." /></div>
          <div className="mc-form-group"><label className="mc-form-label">Compte-rendu</label>
            <textarea className="mc-textarea" value={v.minutes} onChange={(e) => set("minutes", e.target.value)} placeholder="Décisions, votes, points abordés…" /></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : meeting ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modale Mandat ──
interface MandateFV { personId: string; role: string; startDate: string; endDate: string; status: Mandate["status"]; }
function MandateModal({ open, mandate, persons, busy, onSubmit, onClose }: {
  open: boolean; mandate: Mandate | null; persons: Person[]; busy: boolean; onSubmit: (v: MandateFV) => void; onClose: () => void;
}) {
  const [v, setV] = useState<MandateFV>({
    personId: mandate?.person_id ?? "", role: mandate?.role ?? "", startDate: mandate?.start_date ?? "",
    endDate: mandate?.end_date ?? "", status: mandate?.status ?? "actif",
  });
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  function set<K extends keyof MandateFV>(k: K, val: MandateFV[K]) { setV((s) => ({ ...s, [k]: val })); }
  function submit() {
    if (!v.role.trim()) { setError("Le rôle est obligatoire."); return; }
    onSubmit({ ...v, role: v.role.trim() });
  }
  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !busy && onClose()}>
      <div className="mc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{mandate ? "Modifier le mandat" : "Nouveau mandat"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="mc-form-group"><label className="mc-form-label">Rôle *</label>
            <input className="mc-input" value={v.role} autoFocus onChange={(e) => set("role", e.target.value)} placeholder="Président·e, Trésorier·e, Secrétaire…" /></div>
          <div className="mc-form-group"><label className="mc-form-label">Personne</label>
            <select className="mc-input" value={v.personId} onChange={(e) => set("personId", e.target.value)}>
              <option value="">— À définir —</option>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="mc-form-group"><label className="mc-form-label">Début</label>
              <input className="mc-input" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
            <div className="mc-form-group"><label className="mc-form-label">Fin</label>
              <input className="mc-input" type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
          </div>
          <div className="mc-form-group"><label className="mc-form-label">Statut</label>
            <select className="mc-input" value={v.status} onChange={(e) => set("status", e.target.value as Mandate["status"])}>
              <option value="actif">Actif</option><option value="termine">Terminé</option>
            </select></div>
          {error ? <p className="text-sm font-medium text-coral-dark">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={submit} disabled={busy}>{busy ? "…" : mandate ? "Enregistrer" : "Créer"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Résolutions inline ────────────────────────────────────────
const RESULT_LABELS: Record<string, { label: string; cls: string }> = {
  adopte:  { label: "Adopté",   cls: "bg-emerald-100 text-emerald-700" },
  rejete:  { label: "Rejeté",   cls: "bg-red-100 text-red-700" },
  ajourne: { label: "Ajourné",  cls: "bg-amber-100 text-amber-700" },
};

interface ResFV {
  title: string; description: string; result: MeetingResolution["result"];
  votes_pour: number; votes_contre: number; votes_abstention: number;
}
const RES_EMPTY: ResFV = { title: "", description: "", result: "adopte", votes_pour: 0, votes_contre: 0, votes_abstention: 0 };

function ResolutionsPanel({
  meeting, resolutions, orgSlug, orgId,
}: {
  meeting: Meeting;
  resolutions: MeetingResolution[];
  orgSlug: string;
  orgId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ResFV>(RES_EMPTY);

  function setF<K extends keyof ResFV>(k: K, v: ResFV[K]) { setForm((s) => ({ ...s, [k]: v })); }

  function startEdit(r: MeetingResolution) {
    setEditing(r.id);
    setAdding(false);
    setForm({ title: r.title, description: r.description ?? "", result: r.result, votes_pour: r.votes_pour, votes_contre: r.votes_contre, votes_abstention: r.votes_abstention });
  }

  function submitAdd() {
    if (!form.title.trim()) { toast.error("Le titre est obligatoire."); return; }
    startTransition(async () => {
      const res = await createResolutionAction(orgSlug, {
        meeting_id: meeting.id, organization_id: orgId,
        title: form.title.trim(), description: form.description.trim() || null,
        result: form.result, votes_pour: form.votes_pour,
        votes_contre: form.votes_contre, votes_abstention: form.votes_abstention,
        sort_order: resolutions.length,
      });
      if (res.ok) { toast.success("Résolution ajoutée"); setAdding(false); setForm(RES_EMPTY); }
      else toast.error("Impossible d'ajouter la résolution.");
    });
  }

  function submitEdit(id: string) {
    if (!form.title.trim()) { toast.error("Le titre est obligatoire."); return; }
    startTransition(async () => {
      const res = await updateResolutionAction(orgSlug, id, {
        title: form.title.trim(), description: form.description.trim() || null,
        result: form.result, votes_pour: form.votes_pour,
        votes_contre: form.votes_contre, votes_abstention: form.votes_abstention,
      });
      if (res.ok) { toast.success("Résolution mise à jour"); setEditing(null); }
      else toast.error("Impossible de modifier.");
    });
  }

  function doDelete(id: string) {
    startTransition(async () => {
      const res = await deleteResolutionAction(orgSlug, id);
      if (res.ok) toast.success("Résolution supprimée");
      else toast.error("Impossible de supprimer.");
    });
  }

  function ResForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-white p-3">
        <input className="mc-input text-[13px]" placeholder="Titre de la résolution *" value={form.title} onChange={(e) => setF("title", e.target.value)} />
        <textarea className="mc-textarea text-[13px]" placeholder="Description (optionnel)" rows={2} value={form.description} onChange={(e) => setF("description", e.target.value)} />
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-warmgray">Résultat</label>
            <select className="mc-input text-[12px]" value={form.result} onChange={(e) => setF("result", e.target.value as ResFV["result"])}>
              <option value="adopte">Adopté</option>
              <option value="rejete">Rejeté</option>
              <option value="ajourne">Ajourné</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-warmgray">Pour</label>
            <input type="number" min={0} className="mc-input text-[12px]" value={form.votes_pour} onChange={(e) => setF("votes_pour", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-warmgray">Contre</label>
            <input type="number" min={0} className="mc-input text-[12px]" value={form.votes_contre} onChange={(e) => setF("votes_contre", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-warmgray">Abstention</label>
            <input type="number" min={0} className="mc-input text-[12px]" value={form.votes_abstention} onChange={(e) => setF("votes_abstention", Number(e.target.value))} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={onSave} className="mc-btn mc-btn-lime mc-btn-sm flex-1">{pending ? "…" : "Enregistrer"}</button>
          <button type="button" onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
          <Gavel className="size-3.5" /> Résolutions ({resolutions.length})
        </div>
        {!adding && !editing && (
          <button type="button" onClick={() => { setAdding(true); setForm(RES_EMPTY); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100">
            <Plus className="size-3" /> Ajouter
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {resolutions.map((r, i) => {
          const badge = RESULT_LABELS[r.result] ?? { label: r.result, cls: "bg-gray-100 text-gray-700" };
          if (editing === r.id) {
            return <ResForm key={r.id} onSave={() => submitEdit(r.id)} onCancel={() => setEditing(null)} />;
          }
          return (
            <div key={r.id} className="group flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-[13px]">
              <span className="mt-0.5 text-[11px] font-bold text-indigo-400">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                </div>
                {r.description ? <p className="mt-0.5 text-[12px] text-warmgray">{r.description}</p> : null}
                <p className="mt-0.5 text-[11px] text-warmgray">Pour : {r.votes_pour} · Contre : {r.votes_contre} · Abstention : {r.votes_abstention}</p>
              </div>
              <div className="hidden shrink-0 gap-0.5 group-hover:flex">
                <button type="button" disabled={pending} onClick={() => startEdit(r)} className="rounded p-1 text-warmgray hover:bg-indigo-100"><Pencil className="size-3.5" /></button>
                <button type="button" disabled={pending} onClick={() => doDelete(r.id)} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          );
        })}

        {adding && (
          <ResForm onSave={submitAdd} onCancel={() => { setAdding(false); setForm(RES_EMPTY); }} />
        )}

        {resolutions.length === 0 && !adding && (
          <p className="text-[12px] italic text-warmgray">Aucune résolution enregistrée.</p>
        )}
      </div>
    </div>
  );
}

// ── Panneau AG : quorum, émargement, pouvoirs ─────────────────────────────
function AGPanel({
  meeting, persons, proxies, attendance, resolutions, orgSlug, orgId,
}: {
  meeting: Meeting;
  persons: Person[];
  proxies: AssemblyProxy[];
  attendance: AssemblyAttendance[];
  resolutions: MeetingResolution[];
  orgSlug: string;
  orgId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [giverPersonId, setGiverPersonId] = useState("");
  const [holderPersonId, setHolderPersonId] = useState("");

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const attendanceMap = useMemo(() => new Map(attendance.map((a) => [a.person_id, a])), [attendance]);

  const presentCount = attendance.filter((a) => a.present).length;
  const proxyCount   = proxies.length;
  const quorumTotal  = presentCount + proxyCount;
  const quorum       = meeting.quorum;
  const quorumOk     = quorum ? quorumTotal >= quorum : null;

  function togglePresent(personId: string, current: boolean) {
    startTransition(async () => {
      const { ok } = await upsertAttendanceAction(orgSlug, orgId, meeting.id, personId, !current);
      if (!ok) toast.error("Erreur émargement.");
    });
  }

  function addProxy(e: React.FormEvent) {
    e.preventDefault();
    if (!giverPersonId) { toast.error("Sélectionnez le donneur de pouvoir."); return; }
    startTransition(async () => {
      const res = await createProxyAction(orgSlug, orgId, meeting.id, giverPersonId, holderPersonId || null);
      if (res.ok) { toast.success("Pouvoir enregistré."); setGiverPersonId(""); setHolderPersonId(""); }
      else toast.error(res.error ?? "Erreur.");
    });
  }

  function removeProxy(proxyId: string) {
    startTransition(async () => {
      const { ok } = await deleteProxyAction(orgSlug, proxyId);
      if (!ok) toast.error("Erreur suppression pouvoir.");
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      {/* Quorum */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
          <ShieldCheck className="size-3.5" /> Quorum
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink"><strong>{quorumTotal}</strong> représentés</span>
          <span className="text-warmgray">({presentCount} présents + {proxyCount} pouvoirs)</span>
          {quorum && (
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${quorumOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {quorumOk ? "✓ Quorum atteint" : `✗ Quorum requis : ${quorum}`}
            </span>
          )}
        </div>
      </div>

      {/* Émargement */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
          <Users className="size-3.5" /> Émargement
        </div>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {persons.length === 0 ? (
            <p className="text-[12px] text-warmgray">Aucun membre dans la base.</p>
          ) : persons.map((p) => {
            const att = attendanceMap.get(p.id);
            const present = att?.present ?? false;
            return (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => togglePresent(p.id, present)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                  present ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "hover:bg-white/60 text-ink"
                }`}
              >
                <span className={`flex size-4 shrink-0 items-center justify-center rounded text-[10px] ${present ? "bg-emerald-600 text-white" : "border border-warmgray/40"}`}>
                  {present ? "✓" : ""}
                </span>
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pouvoirs */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
          <ArrowRight className="size-3.5" /> Pouvoirs
        </div>
        {proxies.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {proxies.map((prx) => (
              <div key={prx.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-[13px]">
                <span className="font-semibold">{personById.get(prx.giver_person_id)?.name ?? "—"}</span>
                <span className="text-warmgray">→</span>
                <span>{prx.holder_person_id ? personById.get(prx.holder_person_id)?.name ?? "—" : "Représentant non désigné"}</span>
                <button type="button" disabled={pending} onClick={() => removeProxy(prx.id)} className="ml-auto rounded p-0.5 text-red-400 hover:bg-red-50">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addProxy} className="flex items-center gap-2">
          <select value={giverPersonId} onChange={(e) => setGiverPersonId(e.target.value)} className="flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-[12px]">
            <option value="">Donneur de pouvoir…</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ArrowRight className="size-3.5 shrink-0 text-warmgray" />
          <select value={holderPersonId} onChange={(e) => setHolderPersonId(e.target.value)} className="flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-[12px]">
            <option value="">Porteur (optionnel)…</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            <Plus className="size-3.5" />
          </button>
        </form>
      </div>

      {/* Résolutions */}
      <ResolutionsPanel meeting={meeting} resolutions={resolutions} orgSlug={orgSlug} orgId={orgId} />
    </div>
  );
}

export function GouvernanceView({
  meetings, mandates, persons, proxiesByMeeting, attendanceByMeeting, resolutionsByMeeting,
  orgSlug, orgId, orgName,
}: {
  meetings: Meeting[];
  mandates: Mandate[];
  persons: Person[];
  proxiesByMeeting: Record<string, AssemblyProxy[]>;
  attendanceByMeeting: Record<string, AssemblyAttendance[]>;
  resolutionsByMeeting: Record<string, MeetingResolution[]>;
  orgSlug: string;
  orgId: string;
  orgName: string;
}) {
  const [tab, setTab] = useState<Tab>("reunions");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingForm, setMeetingForm] = useState<{ open: boolean; editing: Meeting | null }>({ open: false, editing: null });
  const [mandateForm, setMandateForm] = useState<{ open: boolean; editing: Mandate | null }>({ open: false, editing: null });
  const [confirmM, setConfirmM] = useState<Meeting | null>(null);
  const [confirmMa, setConfirmMa] = useState<Mandate | null>(null);
  const [pending, startTransition] = useTransition();

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const personName = (id: string | null) => id ? personById.get(id)?.name ?? "—" : "À définir";

  const kpis = useMemo(() => ({
    reunions: meetings.length,
    planifiees: meetings.filter((m) => m.status === "planifiee").length,
    mandatsActifs: mandates.filter((m) => m.status === "actif").length,
  }), [meetings, mandates]);

  function submitMeeting(v: MeetingFV) {
    const payload = { type: v.type, title: v.title, date: v.date, agenda: v.agenda.trim() || null, minutes: v.minutes.trim() || null, status: v.status };
    startTransition(async () => {
      const res = meetingForm.editing
        ? await updateMeetingAction(orgSlug, meetingForm.editing.id, payload)
        : await createMeetingAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(meetingForm.editing ? "Réunion mise à jour" : "Réunion créée"); setMeetingForm({ open: false, editing: null }); }
      else toast.error("Action impossible.");
    });
  }
  function submitMandate(v: MandateFV) {
    const payload = { person_id: v.personId || null, role: v.role, start_date: v.startDate || null, end_date: v.endDate || null, status: v.status };
    startTransition(async () => {
      const res = mandateForm.editing
        ? await updateMandateAction(orgSlug, mandateForm.editing.id, payload)
        : await createMandateAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(mandateForm.editing ? "Mandat mis à jour" : "Mandat créé"); setMandateForm({ open: false, editing: null }); }
      else toast.error("Action impossible.");
    });
  }
  function delMeeting(m: Meeting) {
    startTransition(async () => {
      const { ok } = await deleteMeetingAction(orgSlug, m.id);
      if (ok) { toast.success("Réunion supprimée"); setConfirmM(null); setSelectedMeeting(null); } else toast.error("Suppression impossible.");
    });
  }
  function delMandate(m: Mandate) {
    startTransition(async () => {
      const { ok } = await deleteMandateAction(orgSlug, m.id);
      if (ok) { toast.success("Mandat supprimé"); setConfirmMa(null); } else toast.error("Suppression impossible.");
    });
  }

  function sendConvocation(m: Meeting) {
    startTransition(async () => {
      const res = await sendConvocationAction(orgSlug, orgId, m.id, orgName);
      if (res.ok) toast.success(`Convocation envoyée à ${res.sent} membre${res.sent > 1 ? "s" : ""}${res.skipped > 0 ? ` (${res.skipped} sans email)` : ""}`);
      else toast.error("Erreur envoi convocation.");
    });
  }

  const pvUrl = (m: Meeting) => `/dashboard/${orgSlug}/gouvernance/meetings/${m.id}/pv`;

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.reunions}</div><div className="mc-stat-lbl">Réunions</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.planifiees}</div><div className="mc-stat-lbl">À venir</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.mandatsActifs}</div><div className="mc-stat-lbl">Mandats actifs</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-view-toggle">
            <button type="button" className={`mc-view-btn ${tab === "reunions" ? "active" : ""}`} onClick={() => setTab("reunions")}><Calendar className="size-3.5" /> Réunions</button>
            <button type="button" className={`mc-view-btn ${tab === "mandats" ? "active" : ""}`} onClick={() => setTab("mandats")}><User className="size-3.5" /> Mandats</button>
          </div>
          {tab === "reunions"
            ? <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => setMeetingForm({ open: true, editing: null })}><Plus className="size-3.5" /> Réunion</button>
            : <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => setMandateForm({ open: true, editing: null })}><Plus className="size-3.5" /> Mandat</button>}
        </div>
      </div>

      {tab === "reunions" ? (
        meetings.length === 0 ? (
          <div className="mc-card"><div className="mc-empty"><span className="mc-empty-ic"><Gavel className="size-6" strokeWidth={1.8} /></span><div className="mc-empty-title">Aucune réunion</div><p className="mc-empty-sub">Planifiez vos instances : CA, AG, bureau.</p></div></div>
        ) : (
          <div className="flex flex-col gap-3">
            {meetings.map((m) => (
              <button key={m.id} type="button" className="mc-card cursor-pointer px-5 py-4 text-left transition-shadow hover:shadow-md" onClick={() => setSelectedMeeting(m)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mc-badge ${meetingTypeBadge(m.type)}`}>{meetingTypeShort(m.type)}</span>
                      <span className="font-semibold text-foreground">{m.title}</span>
                      <span className={`mc-badge ${meetingStatusBadge(m.status)}`}>{meetingStatusLabel(m.status)}</span>
                      {(m.is_general_assembly || m.type === "ag") && (
                        <span className="mc-badge bg-indigo-100 text-indigo-700">🗳 AG</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[12px] text-warmgray">
                      <Calendar className="size-3.5" /> {formatDateLong(m.date)}
                      {m.minutes ? <><FileText className="ml-2 size-3.5" /> CR disponible</> : null}
                      {(resolutionsByMeeting[m.id]?.length ?? 0) > 0 ? <><Gavel className="ml-2 size-3.5" /> {resolutionsByMeeting[m.id].length} résolution{resolutionsByMeeting[m.id].length > 1 ? "s" : ""}</> : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        mandates.length === 0 ? (
          <div className="mc-card"><div className="mc-empty"><span className="mc-empty-ic"><User className="size-6" strokeWidth={1.8} /></span><div className="mc-empty-title">Aucun mandat</div><p className="mc-empty-sub">Enregistrez les mandats du bureau et des référent·es.</p></div></div>
        ) : (
          <div className="mc-card overflow-hidden">
            <div className="mc-table-wrap">
              <table className="mc-table">
                <thead><tr><th>Rôle</th><th>Personne</th><th>Période</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {mandates.map((m) => (
                    <tr key={m.id}>
                      <td><span className="font-semibold text-foreground">{m.role}</span></td>
                      <td className="text-[13px]">{personName(m.person_id)}</td>
                      <td className="text-[12px] text-warmgray">{mandatePeriod(m.start_date, m.end_date)}</td>
                      <td><span className={`mc-badge ${m.status === "actif" ? "mc-badge-green" : "mc-badge-gray"}`}>{m.status === "actif" ? "Actif" : "Terminé"}</span></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => setMandateForm({ open: true, editing: m })}><Pencil className="size-4" /></button>
                          <button type="button" className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale" onClick={() => setConfirmMa(m)}><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Drawer réunion */}
      {selectedMeeting ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedMeeting(null)} />
          <aside className="mc-drawer" aria-label="Fiche réunion">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selectedMeeting.title}</h2>
                <div className="mt-1 flex gap-1.5"><span className={`mc-badge ${meetingTypeBadge(selectedMeeting.type)}`}>{meetingTypeShort(selectedMeeting.type)}</span><span className={`mc-badge ${meetingStatusBadge(selectedMeeting.status)}`}>{meetingStatusLabel(selectedMeeting.status)}</span></div>
              </div>
              <button type="button" onClick={() => setSelectedMeeting(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-center gap-2 text-sm font-medium"><Calendar className="size-4 text-warmgray" /> {formatDateLong(selectedMeeting.date)}</div>
              {selectedMeeting.agenda ? <div><h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Ordre du jour</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selectedMeeting.agenda}</p></div> : null}
              {selectedMeeting.minutes ? <div><h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Compte-rendu</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selectedMeeting.minutes}</p></div> : null}

              {/* Actions sur la réunion */}
              <div className="flex flex-wrap gap-2">
                {selectedMeeting.status === "planifiee" ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => { startTransition(async () => { const r = await updateMeetingAction(orgSlug, selectedMeeting.id, { status: "tenue" }); if (r.ok) toast.success("Réunion marquée tenue"); }); }} className="mc-btn mc-btn-outline mc-btn-sm"><Check className="size-3.5" /> Marquer tenue</button>
                    <button type="button" disabled={pending} onClick={() => sendConvocation(selectedMeeting)} className="mc-btn mc-btn-outline mc-btn-sm"><Mail className="size-3.5" /> Convoquer les membres</button>
                  </>
                ) : null}
                {selectedMeeting.status === "tenue" ? (
                  <a href={pvUrl(selectedMeeting)} target="_blank" rel="noopener noreferrer" className="mc-btn mc-btn-outline mc-btn-sm">
                    <Download className="size-3.5" /> Télécharger le PV
                  </a>
                ) : null}
              </div>

              {/* Panneau AG — quorum, émargement, pouvoirs, résolutions */}
              {(selectedMeeting.is_general_assembly || selectedMeeting.type === "ag") && (
                <AGPanel
                  meeting={selectedMeeting}
                  persons={persons}
                  proxies={proxiesByMeeting[selectedMeeting.id] ?? []}
                  attendance={attendanceByMeeting[selectedMeeting.id] ?? []}
                  resolutions={resolutionsByMeeting[selectedMeeting.id] ?? []}
                  orgSlug={orgSlug}
                  orgId={orgId}
                />
              )}

              {/* Résolutions pour réunions non-AG */}
              {!(selectedMeeting.is_general_assembly || selectedMeeting.type === "ag") && (
                <div className="rounded-xl border border-border bg-peach-pale/30 p-4">
                  <ResolutionsPanel
                    meeting={selectedMeeting}
                    resolutions={resolutionsByMeeting[selectedMeeting.id] ?? []}
                    orgSlug={orgSlug}
                    orgId={orgId}
                  />
                </div>
              )}
            </div>
            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setMeetingForm({ open: true, editing: selectedMeeting }); setSelectedMeeting(null); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmM(selectedMeeting)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <MeetingModal key={meetingForm.open ? `m-${meetingForm.editing?.id ?? "new"}` : "m-closed"}
        open={meetingForm.open} meeting={meetingForm.editing} busy={pending}
        onClose={() => setMeetingForm({ open: false, editing: null })} onSubmit={submitMeeting} />
      <MandateModal key={mandateForm.open ? `ma-${mandateForm.editing?.id ?? "new"}` : "ma-closed"}
        open={mandateForm.open} mandate={mandateForm.editing} persons={persons} busy={pending}
        onClose={() => setMandateForm({ open: false, editing: null })} onSubmit={submitMandate} />

      <ConfirmDialog open={confirmM !== null} title="Supprimer cette réunion ?"
        message={confirmM ? `« ${confirmM.title} » sera supprimée.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmM(null)} onConfirm={() => confirmM && delMeeting(confirmM)} />
      <ConfirmDialog open={confirmMa !== null} title="Supprimer ce mandat ?"
        message={confirmMa ? `Le mandat « ${confirmMa.role} » sera supprimé.` : ""} confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmMa(null)} onConfirm={() => confirmMa && delMandate(confirmMa)} />
    </div>
  );
}
