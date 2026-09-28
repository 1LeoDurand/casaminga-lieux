"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { ADMIN_PLATFORMS, getAdminPlatformMeta, type AdminPlatform } from "@/lib/admin/platforms";

/**
 * Sélecteur « Vous travaillez sur » en tête de la barre latérale de /admin.
 *
 * La plateforme n'est pas un filtre parmi d'autres : c'est le contexte de
 * travail, choisi une fois et visible partout (liseré, titre d'onglet). Pas
 * d'icône par plateforme ici : la couleur et le mot suffisent (cf. platforms.ts).
 * "Toutes les plateformes" est toujours en dernier, jamais le défaut.
 */
export function PlatformSelector({
  platform,
  onChange,
}: {
  platform: AdminPlatform;
  onChange: (id: AdminPlatform) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getAdminPlatformMeta(platform);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(id: AdminPlatform) {
    setOpen(false);
    if (id !== platform) onChange(id);
  }

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <div className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        Vous travaillez sur
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-[13px] font-semibold text-white/90 transition-colors hover:bg-white/[0.08]"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: current.color }} />
        <span className="flex-1 truncate">{current.label}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-50 overflow-hidden rounded-lg border border-white/10 bg-[#232323] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          {ADMIN_PLATFORMS.filter((p) => p.id !== "all").map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-white/85 transition-colors hover:bg-white/[0.08]"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="flex-1 truncate">{p.label}</span>
              {platform === p.id && <Check className="size-3.5 shrink-0 text-white/70" />}
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          {(() => {
            const all = getAdminPlatformMeta("all");
            return (
              <button
                type="button"
                onClick={() => pick("all")}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.08]"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: all.color }} />
                <span className="flex-1 truncate">{all.label}</span>
                {platform === "all" && <Check className="size-3.5 shrink-0 text-white/70" />}
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
