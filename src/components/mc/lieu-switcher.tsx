"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check, Building2 } from "lucide-react";

export interface LieuOption {
  id: string;
  name: string;
  slug: string;
  city: string | null;
}

export function lieuCookieName(orgSlug: string) {
  return `cm_lieu_${orgSlug}`;
}

/**
 * Sélecteur global de lieu (établissement) dans la topbar.
 * Persiste le choix dans un cookie et rafraîchit les vues serveur (events, lien site public).
 * N'apparaît que pour les organisations à plusieurs lieux.
 */
export function LieuSwitcher({
  orgSlug,
  establishments,
  selectedId,
}: {
  orgSlug: string;
  establishments: LieuOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (establishments.length < 2) return null;

  const selected = establishments.find((e) => e.id === selectedId) ?? null;

  function pick(id: string | null) {
    const name = lieuCookieName(orgSlug);
    if (id) {
      document.cookie = `${name}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } else {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Changer de lieu"
        className="flex h-9 items-center gap-2 rounded-xl border-[1.5px] border-peach bg-peach-pale px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:border-coral hover:bg-peach"
      >
        <MapPin className="size-4 text-coral-dark" />
        <span className="max-w-[140px] truncate">{selected ? selected.name : "Tous les lieux"}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[42px] z-50 w-60 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-peach-pale"
          >
            <Building2 className="size-4 text-warmgray" />
            <span className="flex-1">Tous les lieux</span>
            {!selectedId && <Check className="size-3.5 text-coral-dark" />}
          </button>
          <div className="my-1 border-t border-border" />
          {establishments.map((es) => (
            <button
              key={es.id}
              type="button"
              onClick={() => pick(es.id)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-peach-pale"
            >
              <MapPin className="size-4 text-warmgray" />
              <span className="min-w-0 flex-1 truncate">
                {es.name}
                {es.city ? <span className="text-warmgray"> · {es.city}</span> : null}
              </span>
              {selectedId === es.id && <Check className="size-3.5 shrink-0 text-coral-dark" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
