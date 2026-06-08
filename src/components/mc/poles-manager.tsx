"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Pencil, Trash2, Check, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createPole, updatePole, deletePole } from "@/lib/poles";
import type { Pole, Establishment } from "@/lib/types";

const PRESET_COLORS = [
  "#FF8A65", "#F06292", "#BA68C8", "#7986CB",
  "#4FC3F7", "#4DB6AC", "#81C784", "#FFD54F",
  "#FF7043", "#78909C",
];

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: color }}
      className={`size-6 rounded-full border-2 transition-transform hover:scale-110 ${
        selected ? "border-ink scale-110" : "border-transparent"
      }`}
    />
  );
}

function PoleRow({ pole, orgSlug, lieuName, onEdit }: { pole: Pole; orgSlug: string; lieuName: string | null; onEdit: (p: Pole) => void }) {
  const [, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Désactiver le pôle « ${pole.name} » ?`)) return;
    startTransition(async () => {
      const res = await deletePole(orgSlug, pole.id);
      if (res.ok) toast.success("Pôle désactivé");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
      <div className="size-4 shrink-0 rounded-full" style={{ background: pole.color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">{pole.name}</div>
        {pole.description && <div className="text-[11px] text-warmgray">{pole.description}</div>}
      </div>
      {lieuName && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-peach-pale px-2 py-0.5 text-[10.5px] font-semibold text-coral-dark">
          <MapPin className="size-2.5" /> {lieuName}
        </span>
      )}
      <button onClick={() => onEdit(pole)} className="rounded-lg p-1.5 text-warmgray hover:text-ink">
        <Pencil className="size-3.5" />
      </button>
      <button onClick={remove} className="rounded-lg p-1.5 text-warmgray hover:text-red-600">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function PoleForm({
  orgId, orgSlug, initial, establishments, onDone, onCancel,
}: {
  orgId: string; orgSlug: string; initial?: Pole | null; establishments: Establishment[];
  onDone: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [establishmentId, setEstablishmentId] = useState(initial?.establishment_id ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      color,
      description: description.trim() || null,
      establishment_id: establishmentId || null,
    };
    startTransition(async () => {
      const res = initial
        ? await updatePole(orgSlug, initial.id, payload)
        : await createPole(orgId, orgSlug, payload);
      if (res.ok) { toast.success(initial ? "Pôle mis à jour" : "Pôle créé"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-xl border border-coral/40 bg-peach-pale p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <ColorDot key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
        ))}
      </div>
      <input
        autoFocus
        className="mc-input mb-2"
        placeholder="Nom du pôle (ex. Culture, Coworking…)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
      />
      <input
        className="mc-input mb-2"
        placeholder="Description courte (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {establishments.length > 0 && (
        <select
          className="mc-input mb-3"
          value={establishmentId}
          onChange={(e) => setEstablishmentId(e.target.value)}
        >
          <option value="">Commun à toute la structure</option>
          {establishments.map((es) => (
            <option key={es.id} value={es.id}>{es.name}{es.city ? ` · ${es.city}` : ""}</option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}>
          <X className="size-3.5" /> Annuler
        </button>
        <button onClick={save} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending || !name.trim()}>
          {pending ? "…" : <><Check className="size-3.5" /> {initial ? "Enregistrer" : "Créer"}</>}
        </button>
      </div>
    </div>
  );
}

export function PolesManager({ poles, orgId, orgSlug, establishments = [] }: {
  poles: Pole[]; orgId: string; orgSlug: string; establishments?: Establishment[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Pole | null>(null);

  const lieuName = useMemo(() => new Map(establishments.map((e) => [e.id, e.name])), [establishments]);
  const multiLieu = establishments.length > 0;

  // Regroupement par lieu (Commun en premier, puis chaque lieu) quand multi-lieu
  const groups = useMemo(() => {
    if (!multiLieu) return [{ key: "all", label: "", poles }];
    const commun = poles.filter((p) => !p.establishment_id);
    const out: { key: string; label: string; poles: Pole[] }[] = [];
    if (commun.length) out.push({ key: "commun", label: "Commun à la structure", poles: commun });
    for (const es of establishments) {
      const ps = poles.filter((p) => p.establishment_id === es.id);
      if (ps.length) out.push({ key: es.id, label: es.name, poles: ps });
    }
    return out;
  }, [poles, establishments, multiLieu]);

  function renderPole(p: Pole) {
    return editing?.id === p.id ? (
      <PoleForm
        key={p.id}
        orgId={orgId}
        orgSlug={orgSlug}
        initial={p}
        establishments={establishments}
        onDone={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <PoleRow key={p.id} pole={p} orgSlug={orgSlug} lieuName={p.establishment_id ? lieuName.get(p.establishment_id) ?? null : null} onEdit={setEditing} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {poles.length === 0 && !adding && (
        <p className="text-[13px] text-warmgray">
          Aucun pôle configuré. Les pôles permettent de classifier vos factures et dépenses par activité{multiLieu ? ", et peuvent être rattachés à un lieu précis" : ""}.
        </p>
      )}

      {multiLieu && poles.length > 0 ? (
        groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
            {g.label && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
                {g.key !== "commun" && <MapPin className="size-3" />} {g.label}
              </div>
            )}
            {g.poles.map(renderPole)}
          </div>
        ))
      ) : (
        poles.map(renderPole)
      )}

      {adding ? (
        <PoleForm
          orgId={orgId}
          orgSlug={orgSlug}
          establishments={establishments}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-coral-dark hover:underline"
        >
          <Plus className="size-4" /> Ajouter un pôle
        </button>
      )}
    </div>
  );
}
