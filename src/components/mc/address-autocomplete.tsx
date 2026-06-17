"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";

export interface AddressPick {
  /** Libellé complet (rue + ville). */
  label: string;
  /** Voie / nom de l'adresse. */
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface BanFeature {
  properties: { id?: string; label: string; name?: string; city?: string; postcode?: string };
  geometry: { coordinates: [number, number] }; // [lng, lat]
}

/**
 * Champ d'adresse avec autocomplétion via la Base Adresse Nationale
 * (api-adresse.data.gouv.fr, gratuit, sans clé). À la sélection, renvoie
 * adresse + ville + code postal + coordonnées (pour la carte publique).
 */
export function AddressAutocomplete({
  defaultValue = "",
  onPick,
  inputClassName,
  placeholder = "Commencez à taper une adresse…",
}: {
  defaultValue?: string;
  onPick: (p: AddressPick) => void;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState(defaultValue);
  const [hits, setHits] = useState<BanFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 3) { setHits([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(text)}&limit=5`);
      const json = (await res.json()) as { features?: BanFeature[] };
      setHits(json.features ?? []);
      setOpen((json.features ?? []).length > 0);
    } catch { setHits([]); } finally { setLoading(false); }
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 250);
  }

  function pick(f: BanFeature) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    setQ(p.label);
    setOpen(false);
    onPick({ label: p.label, address: p.name ?? p.label, city: p.city ?? "", postalCode: p.postcode ?? "", lat, lng });
  }

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className={inputClassName}
        value={q}
        onChange={onChange}
        onFocus={() => { if (hits.length) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-warmgray" />}
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
          {hits.map((f, i) => (
            <button
              type="button"
              key={f.properties.id ?? i}
              onClick={() => pick(f)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-peach-pale"
            >
              <MapPin className="size-3.5 shrink-0 text-coral-dark" />
              <span className="truncate">{f.properties.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
