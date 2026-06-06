"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Check, X, MapPin, Star, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createEstablishment, updateEstablishment, setEstablishmentActive } from "@/lib/establishments";
import type { Establishment } from "@/lib/types";

function Form({ orgId, orgSlug, initial, onDone, onCancel }: {
  orgId: string; orgSlug: string; initial?: Establishment | null;
  onDone: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [siret, setSiret] = useState(initial?.siret ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [pending, start] = useTransition();
  const input = "w-full rounded-lg border border-border bg-[#FAFAF7] px-3 py-2 text-sm outline-none focus:border-coral";

  function save() {
    if (!name.trim()) { toast.error("Le nom est obligatoire."); return; }
    start(async () => {
      const payload = { name: name.trim(), city: city.trim() || null, address: address.trim() || null, siret: siret.trim() || null, is_primary: isPrimary };
      const res = initial
        ? await updateEstablishment(orgSlug, initial.id, payload)
        : await createEstablishment(orgId, orgSlug, payload);
      if (res.ok) { toast.success(initial ? "Établissement mis à jour" : "Établissement créé"); onDone(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-xl border border-coral/40 bg-peach-pale p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={input} autoFocus placeholder="Nom du lieu (ex. Lodève, Paris)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className={`${input} sm:col-span-2`} placeholder="Adresse complète" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className={input} placeholder="SIRET (établissement secondaire)" value={siret} onChange={(e) => setSiret(e.target.value)} />
        <label className="flex items-center gap-2 px-1 text-[13px] text-ink">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="size-4 accent-coral" />
          Établissement principal
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending}><X className="size-3.5" /> Annuler</button>
        <button onClick={save} className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}><Check className="size-3.5" /> {initial ? "Enregistrer" : "Créer"}</button>
      </div>
    </div>
  );
}

export function EstablishmentsManager({ establishments, orgId, orgSlug, publicBaseUrl }: {
  establishments: Establishment[]; orgId: string; orgSlug: string; publicBaseUrl: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Establishment | null>(null);
  const [, start] = useTransition();

  function toggleActive(e: Establishment) {
    start(async () => {
      const res = await setEstablishmentActive(orgSlug, e.id, !e.active);
      if (res.ok) toast.success(e.active ? "Établissement désactivé" : "Établissement réactivé");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {establishments.length === 0 && !adding && (
        <p className="text-[13px] text-warmgray">
          Aucun établissement. Créez-en plusieurs si votre structure gère plusieurs lieux
          (chacun aura sa vitrine publique, ses événements et ses adhérents).
        </p>
      )}

      {establishments.map((e) =>
        editing?.id === e.id ? (
          <Form key={e.id} orgId={orgId} orgSlug={orgSlug} initial={e} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        ) : (
          <div key={e.id} className={`flex items-start gap-3 rounded-xl border border-border bg-white p-4 ${!e.active ? "opacity-60" : ""}`}>
            <MapPin className="mt-0.5 size-4 shrink-0 text-coral-dark" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{e.name}</span>
                {e.is_primary && <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><Star className="size-2.5" /> Principal</span>}
                {!e.active && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Inactif</span>}
              </div>
              {(e.city || e.address) && <div className="text-[12px] text-warmgray">{[e.city, e.address].filter(Boolean).join(" · ")}</div>}
              {e.siret && <div className="text-[11px] text-warmgray">SIRET {e.siret}</div>}
              <div className="mt-1 font-mono text-[11px] text-coral-dark">{publicBaseUrl}/{e.slug}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive(e)} className="rounded-lg p-1.5 text-warmgray hover:text-ink" title={e.active ? "Désactiver" : "Réactiver"}>
                {e.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button onClick={() => { setEditing(e); setAdding(false); }} className="rounded-lg p-1.5 text-warmgray hover:text-ink"><Pencil className="size-3.5" /></button>
            </div>
          </div>
        )
      )}

      {adding ? (
        <Form orgId={orgId} orgSlug={orgSlug} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => { setAdding(true); setEditing(null); }} className="flex items-center gap-1.5 text-[13px] font-semibold text-coral-dark hover:underline">
          <Plus className="size-4" /> Ajouter un établissement
        </button>
      )}
    </div>
  );
}
