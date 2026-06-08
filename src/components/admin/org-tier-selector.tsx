"use client";

import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { setOrgTier } from "@/app/admin/organisations/actions";
import type { OrgTier } from "@/lib/modules";

export function OrgTierSelector({
  orgId,
  currentTier,
  currentFounder,
  currentComped,
}: {
  orgId: string;
  currentTier: OrgTier;
  currentFounder: boolean;
  currentComped: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function apply(tier: OrgTier, opts: { founding_member?: boolean; comped?: boolean }) {
    start(async () => {
      const res = await setOrgTier(orgId, tier, opts);
      if (res.ok) {
        toast.success("Abonnement mis à jour ✓");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="rounded-lg border border-border p-1.5 text-warmgray hover:border-slate-300 hover:text-ink"
        title="Changer le tier"
      >
        <Settings2 className="size-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-white shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-warmgray">
            Changer l&apos;abonnement
          </div>
          {[
            { tier: "free" as OrgTier, label: "Gratuit", desc: "Socle uniquement" },
            { tier: "complete" as OrgTier, label: "Asso complète", desc: "Tous les modules" },
            { tier: "multilieu" as OrgTier, label: "Multi-lieux", desc: "Multi-établissements" },
          ].map((opt) => (
            <button
              key={opt.tier}
              onClick={() => apply(opt.tier, {})}
              disabled={pending}
              className={`flex w-full flex-col px-3 py-2 text-left text-[13px] hover:bg-cream ${currentTier === opt.tier && !currentFounder && !currentComped ? "font-semibold text-coral-dark" : "text-ink"}`}
            >
              {opt.label}
              <span className="text-[11px] text-warmgray">{opt.desc}</span>
            </button>
          ))}
          <div className="border-t border-border px-3 py-1.5">
            <button
              onClick={() => apply("complete", { founding_member: true })}
              disabled={pending}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold hover:bg-amber-50 ${currentFounder ? "text-amber-700" : "text-warmgray"}`}
            >
              ⭐ {currentFounder ? "Déjà" : "Marquer"} membre fondateur
            </button>
            <button
              onClick={() => apply("complete", { comped: true })}
              disabled={pending}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold hover:bg-emerald-50 ${currentComped ? "text-emerald-700" : "text-warmgray"}`}
            >
              🎁 {currentComped ? "Déjà" : "Marquer"} offert
            </button>
          </div>
          <div className="border-t border-border px-3 py-1.5">
            <button onClick={() => setOpen(false)} className="w-full text-center text-[12px] text-warmgray hover:text-ink py-1">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
