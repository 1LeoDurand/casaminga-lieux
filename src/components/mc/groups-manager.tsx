"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tags, Plus, Pencil, Trash2, X, Users, Search, Check } from "lucide-react";
import type { MemberGroup } from "@/lib/member-groups";
import { saveGroup, deleteGroup, setGroupMembers } from "@/app/(admin)/dashboard/[org]/personnes/group-actions";

interface PersonLite { id: string; name: string }

const COLORS = ["#FF8A65", "#2f8a4c", "#0e6e7a", "#a06800", "#7c3aed", "#db2777", "#475569"];

export function GroupsManager({
  groups, persons, orgId, orgSlug,
}: {
  groups: MemberGroup[]; persons: PersonLite[]; orgId: string; orgSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="mc-dq-btn">
        <Tags className="mc-dq-ic size-4" /> Groupes{groups.length ? ` (${groups.length})` : ""}
      </button>
      {open && (
        <GroupsModal groups={groups} persons={persons} orgId={orgId} orgSlug={orgSlug} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function GroupsModal({
  groups, persons, orgId, orgSlug, onClose,
}: {
  groups: MemberGroup[]; persons: PersonLite[]; orgId: string; orgSlug: string; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<MemberGroup | "new" | null>(null);
  const [managing, setManaging] = useState<MemberGroup | null>(null);

  function remove(g: MemberGroup) {
    if (!confirm(`Supprimer le groupe « ${g.name} » ? Les personnes ne sont pas supprimées.`)) return;
    startTransition(async () => {
      const res = await deleteGroup(orgSlug, g.id);
      if (res.ok) { toast.success("Groupe supprimé"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  if (managing) {
    return <MembersPanel group={managing} persons={persons} orgSlug={orgSlug} onBack={() => setManaging(null)} onClose={onClose} />;
  }
  if (editing) {
    return <GroupForm group={editing === "new" ? null : editing} orgId={orgId} orgSlug={orgSlug} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">Groupes de membres</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-cream px-4 py-6 text-center text-sm text-warmgray">
            Aucun groupe. Créez-en un pour segmenter vos membres (bénévoles, coworkers, CA…).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: g.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{g.name}</div>
                  <div className="text-[12px] text-warmgray">{g.memberCount} membre{g.memberCount > 1 ? "s" : ""}</div>
                </div>
                <button onClick={() => setManaging(g)} className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-coral-dark hover:bg-peach-pale">
                  <Users className="mr-1 inline size-3.5" />Membres
                </button>
                <button onClick={() => setEditing(g)} className="rounded-lg p-2 text-warmgray hover:text-coral-dark"><Pencil className="size-4" /></button>
                <button onClick={() => remove(g)} disabled={pending} className="rounded-lg p-2 text-warmgray hover:text-red-600"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={() => setEditing("new")} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white hover:bg-coral-dark">
          <Plus className="size-4" /> Nouveau groupe
        </button>
      </div>
    </div>
  );
}

function GroupForm({ group, orgId, orgSlug, onClose }: { group: MemberGroup | null; orgId: string; orgSlug: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name ?? "");
  const [color, setColor] = useState(group?.color ?? COLORS[0]);
  const [description, setDescription] = useState(group?.description ?? "");

  function submit() {
    startTransition(async () => {
      const res = await saveGroup(orgId, orgSlug, { name, color, description: description.trim() || null }, group?.id);
      if (res.ok) { toast.success("Enregistré ✓"); router.refresh(); onClose(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-heading text-lg font-bold text-ink">{group ? "Modifier le groupe" : "Nouveau groupe"}</h3>
        <label className="mb-1 block text-[12px] font-semibold text-ink">Nom *</label>
        <input className="w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm outline-none focus:border-coral" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bénévoles, Coworkers, CA…" autoFocus />
        <label className="mb-1 mt-3 block text-[12px] font-semibold text-ink">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`size-7 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-ink" : ""}`} style={{ background: c }} />
          ))}
        </div>
        <label className="mb-1 mt-3 block text-[12px] font-semibold text-ink">Description</label>
        <input className="w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm outline-none focus:border-coral" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending || !name.trim()} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

function MembersPanel({ group, persons, orgSlug, onBack, onClose }: { group: MemberGroup; persons: PersonLite[]; orgSlug: string; onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(group.memberIds));
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => persons.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [persons, q]
  );

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function save() {
    startTransition(async () => {
      const res = await setGroupMembers(orgSlug, group.id, [...selected]);
      if (res.ok) { toast.success("Membres mis à jour ✓"); router.refresh(); onBack(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="size-3 rounded-full" style={{ background: group.color }} />
          <h3 className="flex-1 font-heading text-base font-bold text-ink">Membres · {group.name}</h3>
          <span className="text-[12px] text-warmgray">{selected.size} sélectionné(s)</span>
        </div>
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-[#FAFAF7] px-3 py-2">
            <Search className="size-4 text-warmgray" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne…" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {filtered.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id}>
                <button onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-cream">
                  <span className={`flex size-5 items-center justify-center rounded-md border ${on ? "border-coral bg-coral text-white" : "border-border"}`}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="text-sm text-ink">{p.name}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-5 py-6 text-center text-sm text-warmgray">Aucune personne.</li>}
        </ul>
        <div className="flex justify-between gap-2 border-t border-border px-5 py-3">
          <button onClick={onBack} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">← Retour</button>
          <button onClick={save} disabled={pending} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
